const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } = require("@aws-sdk/lib-dynamodb");

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const table = process.env.TABLE_NAME;
const sources = new Set(["online", "local-sync", "guest-import"]);

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

function initialState() {
  return {
    phase: "ascent",
    stageId: "esgoto",
    resumePoint: { kind: "start" },
    checkpointId: null,
    credits: { total: 0, consolidatedIds: [] },
    implants: [],
    bodyState: "original-human",
    gateChoice: null,
    descent: {
      step: null,
      chainStatus: "inactive",
      memories: [],
      pendingMemory: null,
      removals: [],
      retryUsedByStage: {},
    },
    ending: null,
    endings: [],
    preGateSnapshot: null,
  };
}

function validateState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return "state ausente";
  for (const key of ["phase", "stageId", "credits", "implants", "bodyState", "descent"]) {
    if (state[key] === undefined) return `state.${key} ausente`;
  }
  return "";
}

function view(item) {
  return {
    id: item.id,
    revision: item.revision,
    schemaVersion: item.schemaVersion,
    updatedAt: item.updatedAt,
    state: item.state,
  };
}

function readBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return JSON.parse(raw);
}

async function load(userId) {
  const out = await db.send(new GetCommand({ TableName: table, Key: { pk: userId, sk: "CAMPAIGN" } }));
  return out.Item || null;
}

async function save(userId, body, current, requestId, eventType) {
  const problem = validateState(body.state);
  if (problem) return fail(422, "INVALID", problem, requestId);
  if (!sources.has(body.source)) return fail(422, "INVALID", "source inválido.", requestId);
  if (body.schemaVersion !== 1) return fail(422, "INVALID", "schemaVersion inválido.", requestId);
  if (typeof body.expectedRevision !== "number") return fail(422, "INVALID", "expectedRevision ausente.", requestId);

  const exists = Boolean(current);
  if ((!exists && body.expectedRevision !== 0) || (exists && current.revision !== body.expectedRevision)) {
    return fail(409, "SAVE_CONFLICT", "A campanha foi alterada em outra sessão.", requestId);
  }

  const payload = {
    id: current?.id || `campaign-${userId}`,
    revision: body.expectedRevision + 1,
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    state: body.state,
  };
  const statusCode = exists ? 200 : 201;
  const campaignPut = {
    TableName: table,
    Item: {
      pk: userId,
      sk: "CAMPAIGN",
      ...payload,
      source: body.source,
      lastOperationId: body.operationId,
      lastStatusCode: statusCode,
      lastResponse: payload,
    },
    ConditionExpression: exists ? "revision = :expected" : "attribute_not_exists(pk)",
  };
  if (exists) campaignPut.ExpressionAttributeValues = { ":expected": body.expectedRevision };

  await db.send(
    new TransactWriteCommand({
      TransactItems: [
        { Put: campaignPut },
        {
          Put: {
            TableName: table,
            Item: {
              pk: userId,
              sk: `OUTBOX#${body.operationId}`,
              eventType,
              operationId: body.operationId,
              createdAt: payload.updatedAt,
            },
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
      ],
    })
  );
  return response(statusCode, payload);
}

exports.handler = async (event) => {
  const requestId = event.requestContext?.requestId || "";
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub || "";
  if (!userId) return fail(401, "UNAUTHENTICATED", "Sessão ausente.", requestId);

  const method = event.requestContext?.http?.method || "";
  const path = event.rawPath || "";

  try {
    const current = await load(userId);
    if (method === "GET" && path === "/me/campaign") {
      if (!current) return fail(404, "NOT_FOUND", "Campanha ausente.", requestId);
      return response(200, view(current));
    }

    const body = readBody(event);
    if (!body.operationId || typeof body.operationId !== "string") {
      return fail(422, "INVALID", "operationId ausente.", requestId);
    }
    if (current?.lastOperationId === body.operationId && current.lastResponse) {
      return response(current.lastStatusCode, current.lastResponse);
    }

    if (method === "PUT" && path === "/me/campaign") {
      return await save(userId, body, current, requestId, "campaign.saved");
    }
    if (method === "POST" && path === "/me/campaign/reset") {
      if (body.confirmed !== true) return fail(422, "INVALID", "Reset exige confirmed: true.", requestId);
      body.state = initialState();
      body.schemaVersion = 1;
      body.source = "online";
      return await save(userId, body, current, requestId, "campaign.reset");
    }
    if (method === "POST" && path === "/me/campaign/restore-gate") {
      if (!current?.state?.preGateSnapshot) {
        return fail(409, "NO_SNAPSHOT", "Campanha sem snapshot pré-Portão.", requestId);
      }
      body.state = current.state.preGateSnapshot;
      body.schemaVersion = current.schemaVersion;
      body.source = "online";
      return await save(userId, body, current, requestId, "campaign.restored");
    }
    return fail(404, "NOT_FOUND", "Rota ausente.", requestId);
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException" || err.name === "TransactionCanceledException") {
      return fail(409, "SAVE_CONFLICT", "A campanha foi alterada em outra sessão.", requestId);
    }
    if (err instanceof SyntaxError) return fail(422, "INVALID", "JSON inválido.", requestId);
    console.error(err);
    return fail(503, "UNAVAILABLE", "Falha ao gravar a campanha.", requestId);
  }
};
