const { randomUUID } = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

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

function publicMatch(item) {
  return {
    id: item.id,
    state: item.state,
    track: item.track,
    rulesVersion: item.rulesVersion,
    inviteCode: item.inviteCode,
    expiresAt: item.expiresAt,
    hostUserId: item.hostUserId,
    guestUserId: item.guestUserId || null,
    ready: item.ready || {},
    result: item.result || null,
  };
}

async function membership(userId, matchId, role) {
  await db.send(
    new PutCommand({
      TableName: table,
      Item: { pk: `USER#${userId}`, sk: matchId, role, createdAt: new Date().toISOString() },
    })
  );
}

exports.handler = async (event) => {
  const requestId = event.requestContext?.requestId || "";
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub || "";
  if (!userId) return fail(401, "UNAUTHENTICATED", "Sessão ausente.", requestId);

  const method = event.requestContext?.http?.method || "";
  const path = event.rawPath || "";

  try {
    if (method === "POST" && path === "/matches") {
      const body = readBody(event);
      if (!body.operationId) return fail(422, "INVALID", "operationId ausente.", requestId);
      const id = randomUUID();
      const item = {
        pk: id,
        sk: "META",
        id,
        state: "lobby",
        track: "multiplayer-race",
        rulesVersion: 1,
        inviteCode: id,
        hostUserId: userId,
        ready: { [userId]: false },
        operationId: body.operationId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };
      await db.send(new PutCommand({ TableName: table, Item: item, ConditionExpression: "attribute_not_exists(pk)" }));
      await membership(userId, id, "host");
      return response(201, publicMatch(item));
    }

    if (method === "POST" && path === "/matches/join") {
      const body = readBody(event);
      if (!body.inviteCode) return fail(422, "INVALID", "inviteCode ausente.", requestId);
      const found = await db.send(new GetCommand({ TableName: table, Key: { pk: body.inviteCode, sk: "META" } }));
      const match = found.Item;
      if (!match || match.state !== "lobby" || match.expiresAt < new Date().toISOString() || match.guestUserId) {
        return fail(422, "INVITE_REJECTED", "Convite inválido.", requestId);
      }
      if (match.hostUserId === userId) return fail(422, "INVITE_REJECTED", "Convite inválido.", requestId);
      await db.send(
        new UpdateCommand({
          TableName: table,
          Key: { pk: match.id, sk: "META" },
          UpdateExpression: "SET guestUserId = :guest",
          ConditionExpression: "attribute_not_exists(guestUserId) AND #state = :lobby",
          ExpressionAttributeNames: { "#state": "state" },
          ExpressionAttributeValues: { ":guest": userId, ":lobby": "lobby" },
        })
      );
      await membership(userId, match.id, "guest");
      match.guestUserId = userId;
      return response(200, publicMatch(match));
    }

    if (method === "GET" && path === "/me/matches") {
      const out = await db.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: { ":pk": `USER#${userId}` },
          Limit: 20,
        })
      );
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const items = (out.Items || []).filter((item) => Date.parse(item.createdAt) >= cutoff);
      return response(200, { items, nextCursor: null });
    }

    const ready = path.match(/^\/matches\/([^/]+)\/ready$/);
    const leave = path.match(/^\/matches\/([^/]+)\/leave$/);
    const read = path.match(/^\/matches\/([^/]+)$/);
    const id = (ready || leave || read)?.[1];
    if (!id || id === "join") return fail(404, "NOT_FOUND", "Rota ausente.", requestId);

    const found = await db.send(new GetCommand({ TableName: table, Key: { pk: id, sk: "META" } }));
    const match = found.Item;
    if (!match) return fail(404, "NOT_FOUND", "Partida ausente.", requestId);
    const participant = match.hostUserId === userId || match.guestUserId === userId;
    if (!participant) return fail(403, "FORBIDDEN", "Partida de outro jogador.", requestId);

    if (method === "GET" && read) return response(200, publicMatch(match));

    if (method === "POST" && ready) {
      const readyMap = { ...(match.ready || {}), [userId]: true };
      const both = Boolean(match.guestUserId) && readyMap[match.hostUserId] && readyMap[match.guestUserId];
      await db.send(
        new UpdateCommand({
          TableName: table,
          Key: { pk: id, sk: "META" },
          UpdateExpression: "SET ready = :ready, #state = :state",
          ExpressionAttributeNames: { "#state": "state" },
          ExpressionAttributeValues: { ":ready": readyMap, ":state": both ? "running" : "lobby" },
        })
      );
      match.ready = readyMap;
      match.state = both ? "running" : match.state;
      return response(200, publicMatch(match));
    }

    if (method === "POST" && leave) {
      const beforeStart = match.state === "lobby";
      const result = beforeStart
        ? null
        : { winnerUserId: match.hostUserId === userId ? match.guestUserId : match.hostUserId, reason: "abandon" };
      await db.send(
        new UpdateCommand({
          TableName: table,
          Key: { pk: id, sk: "META" },
          UpdateExpression: "SET #state = :state, #result = :result",
          ExpressionAttributeNames: { "#state": "state", "#result": "result" },
          ExpressionAttributeValues: {
            ":state": beforeStart ? "cancelled" : "finished",
            ":result": result,
          },
        })
      );
      match.state = beforeStart ? "cancelled" : "finished";
      match.result = result;
      return response(200, publicMatch(match));
    }

    return fail(404, "NOT_FOUND", "Rota ausente.", requestId);
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return fail(422, "INVITE_REJECTED", "Convite inválido.", requestId);
    }
    if (err instanceof SyntaxError) return fail(422, "INVALID", "JSON inválido.", requestId);
    console.error(err);
    return fail(503, "UNAVAILABLE", "Falha na partida.", requestId);
  }
};
