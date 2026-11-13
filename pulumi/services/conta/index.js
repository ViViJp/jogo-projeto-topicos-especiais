const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const lambda = new LambdaClient({});
const table = process.env.TABLE_NAME;

function response(statusCode, body, headers) {
  return {
    statusCode,
    headers: { "content-type": "application/json", ...(headers || {}) },
    body: body === undefined || body === "" ? "" : JSON.stringify(body),
  };
}

function fail(statusCode, code, message, requestId) {
  return response(statusCode, { error: { code, message, requestId } });
}

function readBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return JSON.parse(raw);
}

function readJwt(token) {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("token sem payload");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

function safeReturn(value) {
  if (!value) return "/";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    // destino inválido cai na raiz
  }
  return "/";
}

function redirectUri(event) {
  const configured = process.env.REDIRECT_URI || "";
  if (configured) return configured;
  const host = event.requestContext?.domainName || "";
  return host ? `https://${host}/auth/google/callback` : "";
}

exports.handler = async (event) => {
  const requestId = event.requestContext?.requestId || "";
  const method = event.requestContext?.http?.method || "";
  const path = event.rawPath || "";

  if (method === "GET" && path === "/auth/google/start") return startGoogle(event, requestId);
  if (method === "GET" && path === "/auth/google/callback") return finishGoogle(event, requestId);

  const claims = event.requestContext?.authorizer?.jwt?.claims;
  const userId = claims?.sub || "";
  if (!userId) return fail(401, "UNAUTHENTICATED", "Sessão ausente.", requestId);

  if (method === "POST" && path === "/auth/logout") return logout(event);

  if (method === "GET" && path === "/me") return profile(userId, claims);

  return fail(404, "NOT_FOUND", "Rota ausente.", requestId);
};

function startGoogle(event, requestId) {
  if (process.env.GOOGLE_ENABLED !== "true" || !process.env.COGNITO_DOMAIN || !process.env.COGNITO_CLIENT_ID) {
    return fail(503, "NOT_READY", "Google ainda não está configurado nesta stack.", requestId);
  }
  const redirect = redirectUri(event);
  if (!redirect) return fail(503, "NOT_READY", "Retorno do login ainda não está configurado.", requestId);
  const state = Buffer.from(
    JSON.stringify({ returnTo: safeReturn(event.queryStringParameters?.return) })
  ).toString("base64url");
  const url = new URL(`https://${process.env.COGNITO_DOMAIN}/oauth2/authorize`);
  url.searchParams.set("identity_provider", "Google");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.COGNITO_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  return response(302, "", { location: url.toString() });
}

async function finishGoogle(event, requestId) {
  if (process.env.GOOGLE_ENABLED !== "true") {
    return fail(503, "NOT_READY", "Google ainda não está configurado nesta stack.", requestId);
  }
  const code = event.queryStringParameters?.code || "";
  if (!code) return fail(422, "INVALID", "Código de login ausente.", requestId);
  const redirect = redirectUri(event);
  const tokens = await exchangeCode(code, redirect);
  if (!tokens.id_token) return fail(401, "UNAUTHENTICATED", "Login Google recusado.", requestId);
  const claims = readJwt(tokens.id_token);
  if (!claims.sub) return fail(401, "UNAUTHENTICATED", "Identidade ausente.", requestId);
  const account = await profile(claims.sub, claims, true);
  let returnTo = "/";
  try {
    const state = JSON.parse(Buffer.from(event.queryStringParameters?.state || "", "base64url").toString("utf8"));
    returnTo = safeReturn(state.returnTo);
  } catch {
    returnTo = "/";
  }
  const body = JSON.parse(account.body || "{}");
  return response(200, {
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    returnTo,
    profile: body,
  });
}

async function exchangeCode(code, redirect) {
  const basic = Buffer.from(`${process.env.COGNITO_CLIENT_ID}:${process.env.COGNITO_CLIENT_SECRET}`).toString("base64");
  const result = await fetch(`https://${process.env.COGNITO_DOMAIN}/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
    }),
  });
  if (!result.ok) return {};
  return result.json();
}

async function logout(event) {
  try {
    const body = readBody(event);
    if (body.refreshToken && process.env.COGNITO_DOMAIN && process.env.COGNITO_CLIENT_ID) {
      const basic = Buffer.from(`${process.env.COGNITO_CLIENT_ID}:${process.env.COGNITO_CLIENT_SECRET}`).toString("base64");
      await fetch(`https://${process.env.COGNITO_DOMAIN}/oauth2/revoke`, {
        method: "POST",
        headers: {
          authorization: `Basic ${basic}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ token: body.refreshToken }),
      });
    }
  } catch (err) {
    console.error(err);
  }
  return response(204, "");
}

async function profile(userId, claims, welcomeOnCreate) {
  const found = await db.send(new GetCommand({ TableName: table, Key: { pk: userId, sk: "PROFILE" } }));
  if (found.Item) return response(200, { id: found.Item.id, name: found.Item.name, email: found.Item.email });
  const created = {
    pk: userId,
    sk: "PROFILE",
    id: userId,
    provider: "cognito",
    providerSubject: userId,
    name: claims.name || claims.email || userId,
    email: claims.email || "",
    createdAt: new Date().toISOString(),
  };
  try {
    await db.send(
      new PutCommand({
        TableName: table,
        Item: created,
        ConditionExpression: "attribute_not_exists(pk)",
      })
    );
  } catch (err) {
    if (err.name !== "ConditionalCheckFailedException") throw err;
    const again = await db.send(new GetCommand({ TableName: table, Key: { pk: userId, sk: "PROFILE" } }));
    return response(200, { id: again.Item.id, name: again.Item.name, email: again.Item.email });
  }
  if (welcomeOnCreate) await requestWelcome(created);
  return response(200, { id: created.id, name: created.name, email: created.email });
}

async function requestWelcome(account) {
  const functionName = process.env.COMUNICACOES_FUNCTION_NAME || "";
  if (!functionName) return;
  try {
    await lambda.send(
      new InvokeCommand({
        FunctionName: functionName,
        InvocationType: "Event",
        Payload: Buffer.from(
          JSON.stringify({
            action: "welcome",
            userId: account.id,
            email: account.email,
            name: account.name,
          })
        ),
      })
    );
  } catch (err) {
    console.error(err);
  }
}
