const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const table = process.env.TABLE_NAME;

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function fail(statusCode, code, message, requestId) {
  return response(statusCode, { error: { code, message, requestId } });
}

exports.handler = async (event) => {
  const requestId = event.requestContext?.requestId || "";
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub || "";
  if (!userId) return fail(401, "UNAUTHENTICATED", "Sessão ausente.", requestId);

  const method = event.requestContext?.http?.method || "";
  const path = event.rawPath || "";
  if (method !== "GET" || path !== "/me/audit-events") {
    return fail(404, "NOT_FOUND", "Rota ausente.", requestId);
  }

  const type = event.queryStringParameters?.type;
  const out = await db.send(
    new QueryCommand({
      TableName: table,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: { ":pk": userId, ":prefix": "EVENT#" },
      Limit: 20,
    })
  );
  const items = (out.Items || [])
    .filter((item) => !type || item.type === type)
    .map((item) => ({
      id: item.id,
      type: item.type,
      resource: item.resource,
      result: item.result,
      at: item.at,
      correlation: item.correlation || null,
    }));
  return response(200, { items, nextCursor: null });
};
