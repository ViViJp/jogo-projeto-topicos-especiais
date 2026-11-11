const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const table = process.env.TABLE_NAME;

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: body === undefined ? "" : JSON.stringify(body),
  };
}

function fail(statusCode, code, message, requestId) {
  return response(statusCode, { error: { code, message, requestId } });
}

exports.handler = async (event) => {
  const requestId = event.requestContext?.requestId || "";
  const method = event.requestContext?.http?.method || "";
  const path = event.rawPath || "";

  if (path === "/auth/google/start" || path === "/auth/google/callback") {
    return fail(503, "NOT_READY", "Cognito ainda não está nesta stack.", requestId);
  }

  const claims = event.requestContext?.authorizer?.jwt?.claims;
  const userId = claims?.sub || "";
  if (!userId) return fail(401, "UNAUTHENTICATED", "Sessão ausente.", requestId);

  if (method === "POST" && path === "/auth/logout") {
    return { statusCode: 204, headers: { "content-type": "application/json" }, body: "" };
  }

  if (method === "GET" && path === "/me") {
    const found = await db.send(new GetCommand({ TableName: table, Key: { pk: userId, sk: "PROFILE" } }));
    if (!found.Item) {
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
      await db.send(
        new PutCommand({
          TableName: table,
          Item: created,
          ConditionExpression: "attribute_not_exists(pk)",
        })
      );
      return response(200, { id: created.id, name: created.name, email: created.email });
    }
    return response(200, { id: found.Item.id, name: found.Item.name, email: found.Item.email });
  }

  return fail(404, "NOT_FOUND", "Rota ausente.", requestId);
};
