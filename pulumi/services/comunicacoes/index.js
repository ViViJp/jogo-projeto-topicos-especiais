const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

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

function readBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return JSON.parse(raw);
}

const defaultPreferences = { categories: { welcome: true, ending: false, match: true }, channels: { game: true, email: false }, revision: 1 };

exports.handler = async (event) => {
  const requestId = event.requestContext?.requestId || "";
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub || "";
  if (!userId) return fail(401, "UNAUTHENTICATED", "Sessão ausente.", requestId);

  const method = event.requestContext?.http?.method || "";
  const path = event.rawPath || "";

  try {
    if (method === "GET" && path === "/me/notifications") {
      const out = await db.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
          ExpressionAttributeValues: { ":pk": userId, ":prefix": "NOTE#" },
          Limit: 20,
        })
      );
      const now = new Date().toISOString();
      const items = (out.Items || [])
        .filter((item) => !item.expiresAt || item.expiresAt > now)
        .map((item) => ({
          id: item.id,
          category: item.category,
          target: item.target,
          createdAt: item.createdAt,
          read: Boolean(item.readAt),
        }));
      return response(200, { items, nextCursor: null });
    }

    if (method === "GET" && path === "/me/notification-preferences") {
      const found = await db.send(new GetCommand({ TableName: table, Key: { pk: userId, sk: "PREFERENCES" } }));
      return response(200, found.Item ? found.Item.preferences : defaultPreferences);
    }

    if (method === "PATCH" && path === "/me/notification-preferences") {
      const body = readBody(event);
      if (typeof body.expectedRevision !== "number" || !body.preferences) {
        return fail(422, "INVALID", "Preferências incompletas.", requestId);
      }
      const current = await db.send(new GetCommand({ TableName: table, Key: { pk: userId, sk: "PREFERENCES" } }));
      const revision = current.Item?.preferences?.revision ?? 0;
      if (body.expectedRevision !== revision && !(body.expectedRevision === 0 && !current.Item)) {
        return fail(409, "CONFLICT", "Preferência foi alterada.", requestId);
      }
      if (!current.Item && body.expectedRevision !== 0) {
        return fail(409, "CONFLICT", "Preferência foi alterada.", requestId);
      }
      const next = { ...body.preferences, revision: body.expectedRevision + 1 };
      const put = {
        TableName: table,
        Item: { pk: userId, sk: "PREFERENCES", preferences: next },
        ConditionExpression: current.Item ? "preferences.revision = :expected" : "attribute_not_exists(pk)",
      };
      if (current.Item) put.ExpressionAttributeValues = { ":expected": body.expectedRevision };
      await db.send(new PutCommand(put));
      return response(200, next);
    }

    const mark = path.match(/^\/me\/notifications\/([^/]+)$/);
    if (method === "PATCH" && mark) {
      const body = readBody(event);
      if (body.read !== true) return fail(422, "INVALID", "Leitura exige read: true.", requestId);
      await db.send(
        new UpdateCommand({
          TableName: table,
          Key: { pk: userId, sk: `NOTE#${mark[1]}` },
          UpdateExpression: "SET readAt = :now",
          ConditionExpression: "attribute_exists(pk)",
          ExpressionAttributeValues: { ":now": new Date().toISOString() },
        })
      );
      return response(200, { id: mark[1], read: true });
    }

    return fail(404, "NOT_FOUND", "Rota ausente.", requestId);
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return fail(409, "CONFLICT", "Preferência ou aviso foi alterado.", requestId);
    }
    if (err instanceof SyntaxError) return fail(422, "INVALID", "JSON inválido.", requestId);
    console.error(err);
    return fail(503, "UNAVAILABLE", "Falha nas comunicações.", requestId);
  }
};
