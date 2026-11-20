const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  TransactWriteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { CognitoJwtVerifier } = require("aws-jwt-verify");
const { assessLogin, pkceChallenge, randomToken, safeReturn, withTicket } = require("./oauth");

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const lambda = new LambdaClient({});
const table = process.env.TABLE_NAME;
const loginTtlSeconds = 10 * 60;
const ticketTtlSeconds = 2 * 60;

function response(statusCode, body, extra) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      ...(extra?.headers || {}),
    },
    cookies: extra?.cookies,
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

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function frontendOrigin() {
  return process.env.FRONTEND_ORIGIN || allowedOrigins()[0] || "";
}

function cookieValue(event, name) {
  const prefix = `${name}=`;
  for (const cookie of event.cookies || []) {
    const found = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
    if (found) return decodeURIComponent(found.slice(prefix.length));
  }
  return "";
}

function loginCookie(value, maxAge) {
  return `ftc_oauth=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/auth; Max-Age=${maxAge}`;
}

let idVerifier;
let accessVerifier;

function verifiers() {
  if (!idVerifier) {
    const options = { userPoolId: process.env.COGNITO_POOL_ID, clientId: process.env.COGNITO_CLIENT_ID };
    idVerifier = CognitoJwtVerifier.create({ ...options, tokenUse: "id" });
    accessVerifier = CognitoJwtVerifier.create({ ...options, tokenUse: "access" });
  }
  return { idVerifier, accessVerifier };
}

exports.handler = async (event) => {
  const requestId = event.requestContext?.requestId || "";
  const method = event.requestContext?.http?.method || "";
  const path = event.rawPath || "";

  try {
    if (method === "GET" && path === "/auth/google/start") return await startGoogle(event, requestId);
    if (method === "GET" && path === "/auth/google/callback") return await finishGoogle(event, requestId);
    if (method === "POST" && path === "/auth/session") return await exchangeTicket(event, requestId);
  } catch (err) {
    console.error(err);
    return fail(503, "UNAVAILABLE", "Falha no login.", requestId);
  }

  const claims = event.requestContext?.authorizer?.jwt?.claims || {};
  const userId = claims.sub || "";
  const scope = typeof claims.scope === "string" ? claims.scope.split(" ") : [];
  if (!userId || !scope.includes("openid")) {
    return fail(401, "UNAUTHENTICATED", "Access token ausente.", requestId);
  }

  if (method === "POST" && path === "/auth/logout") return logout(event);
  if (method === "GET" && path === "/me") return profile(userId, claims);

  return fail(404, "NOT_FOUND", "Rota ausente.", requestId);
};

async function startGoogle(event, requestId) {
  if (process.env.GOOGLE_ENABLED !== "true" || !process.env.COGNITO_DOMAIN || !process.env.COGNITO_CLIENT_ID) {
    return fail(503, "NOT_READY", "Google ainda não está configurado nesta stack.", requestId);
  }
  const redirect = redirectUri(event);
  const returnTo = safeReturn(event.queryStringParameters?.return, allowedOrigins(), frontendOrigin());
  if (!redirect || !returnTo.startsWith("http")) {
    return fail(503, "NOT_READY", "Retorno do login ainda não está configurado.", requestId);
  }
  const state = randomToken();
  const verifier = randomToken();
  const expires = new Date(Date.now() + loginTtlSeconds * 1000);
  await db.send(
    new PutCommand({
      TableName: table,
      Item: {
        pk: `LOGIN#${state}`,
        sk: "LOGIN",
        returnTo,
        verifier,
        used: false,
        expiresAt: expires.toISOString(),
        ttl: Math.floor(expires.getTime() / 1000),
      },
    })
  );
  const url = new URL(`https://${process.env.COGNITO_DOMAIN}/oauth2/authorize`);
  url.searchParams.set("identity_provider", "Google");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.COGNITO_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", pkceChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  return response(302, "", { headers: { location: url.toString() }, cookies: [loginCookie(state, loginTtlSeconds)] });
}

async function finishGoogle(event, requestId) {
  const clear = [loginCookie("", 0)];
  if (process.env.GOOGLE_ENABLED !== "true") {
    return fail(503, "NOT_READY", "Google ainda não está configurado nesta stack.", requestId);
  }
  if (event.queryStringParameters?.error) {
    return fail(401, "UNAUTHENTICATED", "Login Google recusado.", requestId);
  }
  const state = event.queryStringParameters?.state || "";
  const code = event.queryStringParameters?.code || "";
  const record = state
    ? (await db.send(new GetCommand({ TableName: table, Key: { pk: `LOGIN#${state}`, sk: "LOGIN" } }))).Item
    : null;
  const verdict = assessLogin(record, cookieValue(event, "ftc_oauth"), state, Date.now());
  if (verdict !== "ok" || !code) {
    return fail(401, "UNAUTHENTICATED", "Retorno de login inválido.", requestId);
  }
  try {
    await db.send(
      new UpdateCommand({
        TableName: table,
        Key: { pk: `LOGIN#${state}`, sk: "LOGIN" },
        UpdateExpression: "SET used = :yes",
        ConditionExpression: "used = :no AND expiresAt > :now",
        ExpressionAttributeValues: { ":yes": true, ":no": false, ":now": new Date().toISOString() },
      })
    );
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return fail(401, "UNAUTHENTICATED", "Retorno de login já utilizado.", requestId);
    }
    throw err;
  }
  const tokens = await exchangeCode(code, redirectUri(event), record.verifier);
  const identity = await verifiedIdentity(tokens);
  if (!identity) return fail(401, "UNAUTHENTICATED", "Identidade recusada.", requestId);
  const account = await ensureAccount(identity.sub, identity);
  const ticket = randomToken();
  const expires = new Date(Date.now() + ticketTtlSeconds * 1000);
  await db.send(
    new PutCommand({
      TableName: table,
      Item: {
        pk: `TICKET#${ticket}`,
        sk: "TICKET",
        accessToken: tokens.access_token,
        idToken: tokens.id_token,
        refreshToken: tokens.refresh_token || "",
        expiresIn: tokens.expires_in || 3600,
        profile: account,
        expiresAt: expires.toISOString(),
        ttl: Math.floor(expires.getTime() / 1000),
      },
    })
  );
  return response(302, "", {
    headers: { location: withTicket(record.returnTo, ticket) },
    cookies: clear,
  });
}

async function exchangeTicket(event, requestId) {
  const ticket = readBody(event).ticket || "";
  if (!ticket) return fail(422, "INVALID", "Ticket ausente.", requestId);
  let removed;
  try {
    removed = await db.send(
      new DeleteCommand({
        TableName: table,
        Key: { pk: `TICKET#${ticket}`, sk: "TICKET" },
        ConditionExpression: "expiresAt > :now",
        ExpressionAttributeValues: { ":now": new Date().toISOString() },
        ReturnValues: "ALL_OLD",
      })
    );
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return fail(401, "UNAUTHENTICATED", "Ticket inválido.", requestId);
    }
    throw err;
  }
  const item = removed.Attributes;
  if (!item?.accessToken) return fail(401, "UNAUTHENTICATED", "Ticket inválido.", requestId);
  return response(200, {
    accessToken: item.accessToken,
    idToken: item.idToken,
    refreshToken: item.refreshToken,
    expiresIn: item.expiresIn,
    profile: item.profile,
  });
}

async function exchangeCode(code, redirect, verifier) {
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
      code_verifier: verifier,
    }),
  });
  if (!result.ok) return {};
  return result.json();
}

async function verifiedIdentity(tokens) {
  if (!tokens.id_token || !tokens.access_token) return null;
  try {
    const { idVerifier: ids, accessVerifier: access } = verifiers();
    const identity = await ids.verify(tokens.id_token);
    await access.verify(tokens.access_token);
    if (!identity.sub) return null;
    return identity;
  } catch (err) {
    console.error(err.name || "jwt");
    return null;
  }
}

function redirectUri(event) {
  const configured = process.env.REDIRECT_URI || "";
  if (configured) return configured;
  const host = event.requestContext?.domainName || "";
  return host ? `https://${host}/auth/google/callback` : "";
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
    console.error(err.name || "logout");
  }
  return response(204, "");
}

async function profile(userId, claims) {
  const account = await ensureAccount(userId, claims);
  return response(200, account);
}

async function ensureAccount(userId, claims) {
  const found = await db.send(new GetCommand({ TableName: table, Key: { pk: userId, sk: "PROFILE" } }));
  let account = found.Item
    ? { id: found.Item.id, name: found.Item.name, email: found.Item.email }
    : null;
  if (!account) {
    account = {
      id: userId,
      name: claims.name || claims.email || userId,
      email: claims.email || "",
    };
    try {
      await db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: table,
                Item: {
                  pk: userId,
                  sk: "PROFILE",
                  provider: "cognito",
                  providerSubject: userId,
                  createdAt: new Date().toISOString(),
                  ...account,
                },
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
            {
              Put: {
                TableName: table,
                Item: { pk: userId, sk: "WELCOME", status: "pending", createdAt: new Date().toISOString() },
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
          ],
        })
      );
    } catch (err) {
      if (err.name !== "TransactionCanceledException") throw err;
      const again = await db.send(new GetCommand({ TableName: table, Key: { pk: userId, sk: "PROFILE" } }));
      account = { id: again.Item.id, name: again.Item.name, email: again.Item.email };
    }
  }
  await ensureWelcome(account);
  return account;
}

async function ensureWelcome(account) {
  try {
    await db.send(
      new PutCommand({
        TableName: table,
        Item: {
          pk: account.id,
          sk: "WELCOME",
          status: "pending",
          note: "pending",
          email: "pending",
          createdAt: new Date().toISOString(),
        },
        ConditionExpression: "attribute_not_exists(pk)",
      })
    );
  } catch (err) {
    if (err.name !== "ConditionalCheckFailedException") console.error(err.name || "welcome");
  }
  await requestWelcome(account);
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
    console.error(err.name || "welcome-invoke");
  }
}
