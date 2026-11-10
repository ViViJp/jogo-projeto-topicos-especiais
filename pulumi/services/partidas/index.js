const crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand } = require("@aws-sdk/lib-dynamodb");
const { generateCode, normalizeCode, hashCode } = require("./codes");

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const table = process.env.TABLE_NAME;
const lobbyMs = 10 * 60 * 1000;

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

function nowIso() {
  return new Date().toISOString();
}

function publicMatch(item, userId) {
  const view = {
    id: item.id,
    state: item.state,
    track: item.track,
    rulesVersion: item.rulesVersion,
    lobbyExpiresAt: item.lobbyExpiresAt,
    hostUserId: item.hostUserId,
    guestUserId: item.guestUserId || null,
    ready: item.ready || {},
    result: item.result || null,
    revision: item.revision,
  };
  if (userId === item.hostUserId && item.state === "lobby") view.inviteCode = item.inviteCode;
  return view;
}

async function getKey(pk, sk) {
  const out = await db.send(new GetCommand({ TableName: table, Key: { pk, sk } }));
  return out.Item || null;
}

function operationPut(userId, operationId, mark, statusCode, payload) {
  return {
    Put: {
      TableName: table,
      Item: { pk: `USER#${userId}`, sk: `OP#${operationId}`, fingerprint: mark, statusCode, response: payload },
      ConditionExpression: "attribute_not_exists(pk)",
    },
  };
}

exports.handler = async (event) => {
  const requestId = event.requestContext?.requestId || "";
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub || "";
  if (!userId) return fail(401, "UNAUTHENTICATED", "Sessão ausente.", requestId);

  const method = event.requestContext?.http?.method || "";
  const path = event.rawPath || "";

  try {
    if (method === "GET" && path === "/me/matches") return listResults(event, userId);

    const body = method === "GET" ? {} : readBody(event);
    if (method !== "GET" && !body.operationId) return fail(422, "INVALID", "operationId ausente.", requestId);
    const mark = crypto
      .createHash("sha256")
      .update(JSON.stringify({ operationId: body.operationId, path, inviteCode: normalizeCode(body.inviteCode) }))
      .digest("hex");
    if (body.operationId) {
      const previous = await getKey(`USER#${userId}`, `OP#${body.operationId}`);
      if (previous) {
        if (previous.fingerprint !== mark) return fail(409, "OPERATION_CONFLICT", "operationId reutilizado com outro conteúdo.", requestId);
        return response(previous.statusCode, previous.response);
      }
    }

    if (method === "POST" && path === "/matches") return createMatch(userId, body.operationId, mark);
    if (method === "POST" && path === "/matches/join") return joinMatch(userId, body, mark, requestId);

    const ready = path.match(/^\/matches\/([^/]+)\/ready$/);
    const leave = path.match(/^\/matches\/([^/]+)\/leave$/);
    const read = path.match(/^\/matches\/([^/]+)$/);
    const id = (ready || leave || read)?.[1];
    if (!id || id === "join") return fail(404, "NOT_FOUND", "Rota ausente.", requestId);

    const match = await getKey(`MATCH#${id}`, "META");
    if (!match) return fail(404, "NOT_FOUND", "Partida ausente.", requestId);
    const participant = match.hostUserId === userId || match.guestUserId === userId;
    if (!participant) return fail(403, "FORBIDDEN", "Partida de outro jogador.", requestId);
    if (method === "GET" && read) return response(200, publicMatch(match, userId));
    if (method === "POST" && ready) return markReady(userId, match, body.operationId, mark, requestId);
    if (method === "POST" && leave) return leaveMatch(userId, match, body.operationId, mark, requestId);
    return fail(404, "NOT_FOUND", "Rota ausente.", requestId);
  } catch (err) {
    if (err.name === "TransactionCanceledException" || err.name === "ConditionalCheckFailedException") {
      return fail(409, "MATCH_CONFLICT", "A partida mudou ou o convite não vale mais.", requestId);
    }
    if (err instanceof SyntaxError) return fail(422, "INVALID", "JSON inválido.", requestId);
    console.error(err);
    return fail(503, "UNAVAILABLE", "Falha na partida.", requestId);
  }
};

async function listResults(event, userId) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let startKey;
  if (event.queryStringParameters?.cursor) {
    startKey = JSON.parse(Buffer.from(event.queryStringParameters.cursor, "base64").toString("utf8"));
  }
  const out = await db.send(
    new QueryCommand({
      TableName: table,
      KeyConditionExpression: "pk = :pk AND sk BETWEEN :from AND :to",
      ExpressionAttributeValues: { ":pk": `USER#${userId}`, ":from": `RESULT#${cutoff}`, ":to": "RESULT#~" },
      Limit: 20,
      ScanIndexForward: false,
      ExclusiveStartKey: startKey,
    })
  );
  return response(200, {
    items: (out.Items || []).map((item) => ({
      matchId: item.matchId,
      at: item.at,
      result: item.result,
    })),
    nextCursor: out.LastEvaluatedKey ? Buffer.from(JSON.stringify(out.LastEvaluatedKey)).toString("base64") : null,
  });
}

async function createMatch(userId, operationId, mark) {
  const active = await getKey(`USER#${userId}`, "ACTIVE");
  if (active) {
    const old = await getKey(`MATCH#${active.matchId}`, "META");
    const lobbyDead = old && old.state === "lobby" && old.lobbyExpiresAt <= nowIso();
    if (!lobbyDead) return fail(409, "ACTIVE_MATCH", "Já existe uma partida ativa.", "");
    await db.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName: table,
              Key: { pk: `USER#${userId}`, sk: "ACTIVE" },
              ConditionExpression: "matchId = :id",
              ExpressionAttributeValues: { ":id": old.id },
            },
          },
          {
            Update: {
              TableName: table,
              Key: { pk: `MATCH#${old.id}`, sk: "META" },
              UpdateExpression: "SET #state = :cancelled",
              ConditionExpression: "#state = :lobby AND lobbyExpiresAt <= :now",
              ExpressionAttributeNames: { "#state": "state" },
              ExpressionAttributeValues: { ":cancelled": "cancelled", ":lobby": "lobby", ":now": nowIso() },
            },
          },
        ],
      })
    );
  }

  const id = crypto.randomUUID();
  const code = generateCode();
  const createdAt = nowIso();
  const lobbyExpiresAt = new Date(Date.now() + lobbyMs).toISOString();
  const item = {
    pk: `MATCH#${id}`,
    sk: "META",
    id,
    state: "lobby",
    revision: 1,
    track: "multiplayer-race",
    rulesVersion: 1,
    inviteCode: code,
    hostUserId: userId,
    ready: { [userId]: false },
    lobbyExpiresAt,
    createdAt,
  };
  const payload = publicMatch(item, userId);
  await db.send(
    new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: table, Item: item, ConditionExpression: "attribute_not_exists(pk)" } },
        {
          Put: {
            TableName: table,
            Item: {
              pk: `INVITE#${hashCode(code)}`,
              sk: "META",
              matchId: id,
              expiresAt: lobbyExpiresAt,
              consumed: false,
              ttl: Math.floor(Date.parse(lobbyExpiresAt) / 1000) + 86400,
            },
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
        {
          Put: {
            TableName: table,
            Item: { pk: `USER#${userId}`, sk: "ACTIVE", matchId: id },
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
        operationPut(userId, operationId, mark, 201, payload),
      ],
    })
  );
  return response(201, payload);
}

async function joinMatch(userId, body, mark, requestId) {
  const code = normalizeCode(body.inviteCode);
  if (!code) return fail(422, "INVALID", "Convite inválido.", requestId);
  const invite = await getKey(`INVITE#${hashCode(code)}`, "META");
  if (!invite || invite.consumed || invite.expiresAt <= nowIso()) return fail(422, "INVITE_REJECTED", "Convite inválido.", requestId);
  const match = await getKey(`MATCH#${invite.matchId}`, "META");
  if (!match || match.state !== "lobby" || match.guestUserId || match.hostUserId === userId || match.lobbyExpiresAt <= nowIso()) {
    return fail(422, "INVITE_REJECTED", "Convite inválido.", requestId);
  }
  const payload = publicMatch({ ...match, guestUserId: userId }, userId);
  await db.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: table,
            Key: { pk: match.pk, sk: "META" },
            UpdateExpression: "SET guestUserId = :guest, revision = revision + :one",
            ConditionExpression: "#state = :lobby AND attribute_not_exists(guestUserId) AND hostUserId <> :guest AND lobbyExpiresAt > :now",
            ExpressionAttributeNames: { "#state": "state" },
            ExpressionAttributeValues: { ":guest": userId, ":one": 1, ":lobby": "lobby", ":now": nowIso() },
          },
        },
        {
          Update: {
            TableName: table,
            Key: { pk: invite.pk, sk: "META" },
            UpdateExpression: "SET consumed = :yes",
            ConditionExpression: "consumed = :no AND expiresAt > :now",
            ExpressionAttributeValues: { ":yes": true, ":no": false, ":now": nowIso() },
          },
        },
        {
          Put: {
            TableName: table,
            Item: { pk: `USER#${userId}`, sk: "ACTIVE", matchId: match.id },
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
        operationPut(userId, body.operationId, mark, 200, payload),
      ],
    })
  );
  return response(200, payload);
}

async function markReady(userId, match, operationId, mark, requestId) {
  if (match.state !== "lobby" || match.lobbyExpiresAt <= nowIso()) {
    return fail(409, "MATCH_CLOSED", "A partida não está aguardando largada.", requestId);
  }
  const ready = { ...(match.ready || {}), [userId]: true };
  const both = Boolean(match.guestUserId) && ready[match.hostUserId] && ready[match.guestUserId];
  const next = { ...match, ready, state: both ? "running" : "lobby", revision: match.revision + 1 };
  const payload = publicMatch(next, userId);
  const items = [
    {
      Update: {
        TableName: table,
        Key: { pk: match.pk, sk: "META" },
        UpdateExpression: "SET ready = :ready, #state = :state, revision = revision + :one",
        ConditionExpression: "#state = :lobby AND revision = :revision AND lobbyExpiresAt > :now",
        ExpressionAttributeNames: { "#state": "state" },
        ExpressionAttributeValues: {
          ":ready": ready,
          ":state": next.state,
          ":one": 1,
          ":lobby": "lobby",
          ":revision": match.revision,
          ":now": nowIso(),
        },
      },
    },
    operationPut(userId, operationId, mark, 200, payload),
  ];
  if (both) {
    items.push({
      Update: {
        TableName: table,
        Key: { pk: `INVITE#${hashCode(match.inviteCode)}`, sk: "META" },
        UpdateExpression: "SET consumed = :yes",
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeValues: { ":yes": true },
      },
    });
  }
  await db.send(new TransactWriteCommand({ TransactItems: items }));
  return response(200, payload);
}

async function leaveMatch(userId, match, operationId, mark, requestId) {
  if (match.state !== "lobby" && match.state !== "running") {
    return fail(409, "MATCH_CLOSED", "A partida já foi encerrada.", requestId);
  }
  const beforeStart = match.state === "lobby";
  const finishedAt = nowIso();
  const result = beforeStart
    ? null
    : { winnerUserId: match.hostUserId === userId ? match.guestUserId : match.hostUserId, reason: "abandon" };
  const nextState = beforeStart ? "cancelled" : "finished";
  const payload = publicMatch({ ...match, state: nextState, result }, userId);
  const items = [
    {
      Update: {
        TableName: table,
        Key: { pk: match.pk, sk: "META" },
        UpdateExpression: "SET #state = :state, #result = :result, revision = revision + :one",
        ConditionExpression: "#state = :current AND revision = :revision",
        ExpressionAttributeNames: { "#state": "state", "#result": "result" },
        ExpressionAttributeValues: {
          ":state": nextState,
          ":result": result,
          ":one": 1,
          ":current": match.state,
          ":revision": match.revision,
        },
      },
    },
    {
      Delete: {
        TableName: table,
        Key: { pk: `USER#${match.hostUserId}`, sk: "ACTIVE" },
        ConditionExpression: "matchId = :id",
        ExpressionAttributeValues: { ":id": match.id },
      },
    },
    {
      Update: {
        TableName: table,
        Key: { pk: `INVITE#${hashCode(match.inviteCode)}`, sk: "META" },
        UpdateExpression: "SET consumed = :yes",
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeValues: { ":yes": true },
      },
    },
    operationPut(userId, operationId, mark, 200, payload),
  ];
  if (match.guestUserId) {
    items.push({
      Delete: {
        TableName: table,
        Key: { pk: `USER#${match.guestUserId}`, sk: "ACTIVE" },
        ConditionExpression: "matchId = :id",
        ExpressionAttributeValues: { ":id": match.id },
      },
    });
  }
  if (!beforeStart) {
    for (const participant of [match.hostUserId, match.guestUserId].filter(Boolean)) {
      items.push({
        Put: {
          TableName: table,
          Item: {
            pk: `USER#${participant}`,
            sk: `RESULT#${finishedAt}#${match.id}`,
            matchId: match.id,
            at: finishedAt,
            result,
          },
          ConditionExpression: "attribute_not_exists(pk)",
        },
      });
    }
  }
  await db.send(new TransactWriteCommand({ TransactItems: items }));
  return response(200, payload);
};
