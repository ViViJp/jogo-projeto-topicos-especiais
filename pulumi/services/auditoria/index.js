const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand } = require("@aws-sdk/lib-dynamodb");

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

async function ingest(events) {
  const stored = [];
  for (const entry of events) {
    if (!entry?.id) continue;
    const at = entry.at || new Date().toISOString();
    const recipients = [...new Set([entry.userId, ...(entry.userIds || [])].filter(Boolean))];
    for (const userId of recipients) {
      try {
        await db.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: table,
                  Item: { pk: userId, sk: `DEDUP#${entry.id}` },
                  ConditionExpression: "attribute_not_exists(pk)",
                },
              },
              {
                Put: {
                  TableName: table,
                  Item: {
                    pk: userId,
                    sk: `EVENT#${at}#${entry.id}`,
                    id: entry.id,
                    type: entry.type,
                    resource: entry.resource,
                    result: entry.result,
                    at,
                    correlation: entry.correlation || entry.id,
                  },
                  ConditionExpression: "attribute_not_exists(pk)",
                },
              },
            ],
          })
        );
        stored.push(`${userId}:${entry.id}`);
      } catch (err) {
        if (err.name !== "TransactionCanceledException") throw err;
      }
    }
  }
  return { statusCode: 200, body: JSON.stringify({ stored }) };
}

exports.handler = async (event) => {
  if (Array.isArray(event.Records)) {
    const batchItemFailures = [];
    for (const record of event.Records) {
      try {
        await ingest([JSON.parse(record.body)]);
      } catch (err) {
        console.error("audit event ingestion failed", { errorName: err?.name || "Error" });
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }
    return { batchItemFailures };
  }
  if (!event.requestContext?.http && event.action === "ingest") return ingest(event.events || []);

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
      ScanIndexForward: false,
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
