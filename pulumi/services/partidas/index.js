const crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, DeleteCommand, GetCommand, PutCommand, QueryCommand, TransactWriteCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { generateCode, normalizeCode, hashCode } = require("./codes");
const { buildRaceResult, incompleteConfirmation, normalizeParticipant, submissionsAgree } = require("./results");
const { consumeDecision, issueDecision } = require("./ticket");
const { PRESENCE_LEASE_MS, participantIds, presenceFresh, presenceState, allParticipantsStale, awardDisconnectAllowed } = require("./lease");

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
    resultStatus: item.resultStatus || "none",
    revision: item.revision,
  };
  if (userId === item.hostUserId && item.state === "lobby") view.inviteCode = item.inviteCode;
  return view;
}

async function getKey(pk, sk) {
  const out = await db.send(new GetCommand({ TableName: table, Key: { pk, sk } }));
  return out.Item || null;
}

function releaseActive(userId, matchId) {
  return {
    Delete: {
      TableName: table,
      Key: { pk: `USER#${userId}`, sk: "ACTIVE" },
      ConditionExpression: "matchId = :id",
      ExpressionAttributeValues: { ":id": matchId },
    },
  };
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

function outboxPut(matchId, operationId, type, userIds, at, detail = {}) {
  return {
    Put: {
      TableName: table,
      Item: {
        pk: `MATCH#${matchId}`,
        sk: `OUTBOX#${operationId}`,
        id: operationId,
        userIds: [...new Set(userIds.filter(Boolean))],
        type,
        resource: matchId,
        result: "accepted",
        at,
        correlation: operationId,
        detail,
      },
      ConditionExpression: "attribute_not_exists(pk)",
    },
  };
}

exports.handler = async (event) => {
  if (event?.action === "consumeTicket") {
    try {
      return await consumeStoredTicket(event.ticket);
    } catch (err) {
      if (err.name === "ConditionalCheckFailedException") return { accepted: false, reason: "used" };
      console.error(err);
      return { accepted: false };
    }
  }
  const requestId = event.requestContext?.requestId || "";
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub || "";
  if (!userId) return fail(401, "UNAUTHENTICATED", "Sessão ausente.", requestId);

  const method = event.requestContext?.http?.method || "";
  const path = event.rawPath || "";

  try {
    const ticketRoute = path.match(/^\/matches\/([^/]+)\/connection-ticket$/);
    if (method === "POST" && ticketRoute) {
      const ticketMatch = await getKey(`MATCH#${ticketRoute[1]}`, "META");
      if (!ticketMatch) return fail(404, "NOT_FOUND", "Partida ausente.", requestId);
      return issueConnectionTicket(userId, ticketMatch, requestId);
    }
    if (method === "GET" && path === "/me/matches") return listResults(event, userId);

    const body = method === "GET" ? {} : readBody(event);
    const heartbeat = path.match(/^\/matches\/([^/]+)\/heartbeat$/);
    if (method !== "GET" && !heartbeat && !body.operationId) {
      return fail(422, "INVALID", "operationId ausente.", requestId);
    }
    const mark = crypto
      .createHash("sha256")
      .update(JSON.stringify({
        operationId: body.operationId,
        path,
        inviteCode: normalizeCode(body.inviteCode),
        result: body.result,
        observedOpponent: body.observedOpponent,
        ...(body.disconnect === true ? { disconnect: true } : {}),
      }))
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
    const finish = path.match(/^\/matches\/([^/]+)\/finish$/);
    const recover = path.match(/^\/matches\/([^/]+)\/recover$/);
    const read = path.match(/^\/matches\/([^/]+)$/);
    const id = (ready || leave || finish || recover || heartbeat || read)?.[1];
    if (!id || id === "join") return fail(404, "NOT_FOUND", "Rota ausente.", requestId);

    const match = await getKey(`MATCH#${id}`, "META");
    if (!match) return fail(404, "NOT_FOUND", "Partida ausente.", requestId);
    const participant = match.hostUserId === userId || match.guestUserId === userId;
    if (!participant) return fail(403, "FORBIDDEN", "Partida de outro jogador.", requestId);
    if (method === "GET" && read) return response(200, publicMatch(await settleIfExpired(match), userId));
    if (method === "POST" && heartbeat) return heartbeatMatch(userId, match, body, requestId);
    if (method === "POST" && ready) return markReady(userId, match, body.operationId, mark, requestId);
    if (method === "POST" && leave) return leaveMatch(userId, match, body.operationId, mark, requestId);
    if (method === "POST" && recover) return recoverMatch(userId, match, body.operationId, mark, requestId);
    if (method === "POST" && finish) return finishMatch(userId, match, body, mark, requestId);
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

async function issueConnectionTicket(userId, match, requestId) {
  const decision = issueDecision(match, userId, Date.now());
  if (decision.error === "not-participant") return fail(403, "FORBIDDEN", "Partida de outro jogador.", requestId);
  if (decision.error) return fail(409, "MATCH_CLOSED", "A partida não aceita mais conexão.", requestId);
  const ticket = crypto.randomBytes(32).toString("base64url");
  await db.send(new PutCommand({
    TableName: table,
    Item: {
      pk: `TICKET#${ticket}`,
      sk: "TICKET",
      userId,
      matchId: match.id,
      expiresAt: decision.expiresAt,
      ttl: Math.floor(Date.parse(decision.expiresAt) / 1000),
    },
    ConditionExpression: "attribute_not_exists(pk)",
  }));
  return response(201, { ticket, expiresAt: decision.expiresAt, userId, matchId: match.id });
}

async function consumeStoredTicket(ticket) {
  if (!ticket || typeof ticket !== "string" || ticket.length > 128) return { accepted: false, reason: "unauthenticated" };
  const found = await getKey(`TICKET#${ticket}`, "TICKET");
  const decision = consumeDecision(found, Date.now());
  if (!decision.userId) return { accepted: false, reason: decision.error };
  await db.send(new DeleteCommand({
    TableName: table,
    Key: { pk: `TICKET#${ticket}`, sk: "TICKET" },
    ConditionExpression: "expiresAt > :now",
    ExpressionAttributeValues: { ":now": new Date().toISOString() },
  }));
  return { accepted: true, userId: decision.userId, matchId: decision.matchId };
}

async function closeMissingConfirmation(match, operationId) {
  const ids = participantIds(match);
  const submitted = ids.filter((id) => match.submissions?.[id]);
  const missingUserId = submitted.length === 1 ? ids.find((id) => id !== submitted[0]) : null;
  const state = missingUserId ? presenceState(match, missingUserId) : "unknown";
  const decision = incompleteConfirmation(match.submissions, ids, Date.now(), {
    opponentAbsent: state === "absent",
    opponentPresent: state === "present",
  });
  if (!decision || match.state !== "running") return match;
  const finishedAt = decision.result.finishedAt;
  const participants = ids;
  try {
    await db.send(new TransactWriteCommand({ TransactItems: [
      {
        Update: {
          TableName: table,
          Key: { pk: match.pk, sk: "META" },
          UpdateExpression: "SET #state = :finished, #result = :result, resultStatus = :status, finishedAt = :at, revision = revision + :one",
          ConditionExpression: "#state = :running AND resultStatus = :pending AND revision = :revision",
          ExpressionAttributeNames: { "#state": "state", "#result": "result" },
          ExpressionAttributeValues: {
            ":finished": "finished", ":running": "running", ":pending": "pending",
            ":result": decision.result, ":status": decision.resultStatus, ":at": finishedAt,
            ":one": 1, ":revision": match.revision,
          },
        },
      },
      ...participants.map((participant) => ({
        Delete: { TableName: table, Key: { pk: `USER#${participant}`, sk: "ACTIVE" } },
      })),
      ...participants.map((participant) => ({
        Put: {
          TableName: table,
          Item: {
            pk: `USER#${participant}`, sk: `RESULT#${finishedAt}#${match.id}`,
            matchId: match.id, at: finishedAt, result: decision.result, resultStatus: decision.resultStatus,
          },
          ConditionExpression: "attribute_not_exists(pk)",
        },
      })),
      outboxPut(match.id, operationId, "match.finished", participants, finishedAt, {
        winnerUserId: decision.result.winnerUserId,
        reason: decision.result.reason,
        missingConfirmation: true,
        unconfirmedUserId: decision.result.unconfirmedUserId,
      }),
    ] }));
  } catch (err) {
    if (err.name !== "TransactionCanceledException" && err.name !== "ConditionalCheckFailedException") throw err;
    return (await getKey(match.pk, "META")) || match;
  }
  return {
    ...match,
    state: "finished",
    result: decision.result,
    resultStatus: decision.resultStatus,
    finishedAt,
    revision: match.revision + 1,
  };
}

function settleIfExpired(match) {
  return closeMissingConfirmation(match, `missing-${match.id}`);
}

async function listResults(event, userId) {
  const active = await getKey(`USER#${userId}`, "ACTIVE");
  if (active?.matchId) {
    const current = await getKey(`MATCH#${active.matchId}`, "META");
    if (current?.state === "running" && current.resultStatus === "pending") {
      await closeMissingConfirmation(current, `missing-${current.id}`);
    }
  }
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
      resultStatus: item.resultStatus || "confirmed",
    })),
    nextCursor: out.LastEvaluatedKey ? Buffer.from(JSON.stringify(out.LastEvaluatedKey)).toString("base64") : null,
  });
}

async function createMatch(userId, operationId, mark) {
  const active = await getKey(`USER#${userId}`, "ACTIVE");
  if (active) {
    const old = await getKey(`MATCH#${active.matchId}`, "META");
    if (old && (old.state === "lobby" || old.state === "running")) {
      const lobbyExpired = old.state === "lobby" && old.lobbyExpiresAt <= nowIso();
      if (!lobbyExpired && !allParticipantsStale(old)) {
        const settled = await settleIfExpired(old);
        if (settled.state === "lobby" || settled.state === "running") {
          return response(200, publicMatch(settled, userId));
        }
      } else {
        const closed = old.state === "running"
          ? await closeMissingConfirmation(old, `${operationId}-missing`)
          : old;
        if (closed.state === "lobby" || closed.state === "running") {
          const cleanupAt = nowIso();
          await db.send(new TransactWriteCommand({ TransactItems: [
            {
              Update: {
                TableName: table,
                Key: { pk: old.pk, sk: "META" },
                UpdateExpression: "SET #state = :cancelled, resultStatus = :expired, revision = revision + :one",
                ConditionExpression: "#state = :current AND revision = :revision",
                ExpressionAttributeNames: { "#state": "state" },
                ExpressionAttributeValues: {
                  ":cancelled": "cancelled", ":expired": "expired", ":one": 1,
                  ":current": old.state, ":revision": old.revision,
                },
              },
            },
            ...participantIds(old).map((participant) => ({
              Delete: { TableName: table, Key: { pk: `USER#${participant}`, sk: "ACTIVE" } },
            })),
            outboxPut(old.id, `${operationId}-expired`, "match.cancelled", participantIds(old), cleanupAt, {
              reason: "presence-timeout",
            }),
          ] }));
        }
      }
    } else {
      await db.send(new TransactWriteCommand({ TransactItems: [{
        Delete: { TableName: table, Key: { pk: `USER#${userId}`, sk: "ACTIVE" } },
      }] }));
    }
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
    presence: { [userId]: { lastSeenAt: createdAt, connected: false } },
    submissions: {},
    resultStatus: "none",
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
        outboxPut(id, operationId, "match.created", [userId], createdAt),
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
  const joinedAt = nowIso();
  const presence = { ...(match.presence || {}), [userId]: { lastSeenAt: joinedAt, connected: false } };
  const ready = { ...(match.ready || {}), [userId]: false };
  const payload = publicMatch({ ...match, guestUserId: userId, presence, ready, revision: match.revision + 1 }, userId);
  await db.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: table,
            Key: { pk: match.pk, sk: "META" },
            UpdateExpression: "SET guestUserId = :guest, presence = :presence, ready = :ready, revision = revision + :one",
            ConditionExpression: "#state = :lobby AND attribute_not_exists(guestUserId) AND hostUserId <> :guest AND lobbyExpiresAt > :now",
            ExpressionAttributeNames: { "#state": "state" },
            ExpressionAttributeValues: {
              ":guest": userId, ":presence": presence, ":ready": ready,
              ":one": 1, ":lobby": "lobby", ":now": joinedAt,
            },
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
        outboxPut(match.id, body.operationId, "match.joined", [match.hostUserId, userId], joinedAt),
        operationPut(userId, body.operationId, mark, 200, payload),
      ],
    })
  );
  return response(200, payload);
}

async function heartbeatMatch(userId, match, body, requestId) {
  const settled = await settleIfExpired(match);
  if (settled.state !== "lobby" && settled.state !== "running") {
    return response(200, publicMatch(settled, userId));
  }
  match = settled;
  if (match.state !== "lobby" && match.state !== "running") {
    return fail(409, "MATCH_CLOSED", "A partida já foi encerrada.", requestId);
  }
  const connected = body.connected === true;
  const presence = { lastSeenAt: nowIso(), connected };
  const names = { "#presence": "presence", "#user": userId, "#state": "state" };
  const values = { ":presence": presence, ":lobby": "lobby", ":running": "running" };
  const setExpressions = ["#presence.#user = :presence"];
  values[":one"] = 1;
  values[":revision"] = match.revision;
  if (match.state === "lobby" && !connected) {
    names["#ready"] = "ready";
    setExpressions.push("#ready.#user = :notReady");
    values[":notReady"] = false;
  }
  const update = `SET ${setExpressions.join(", ")} ADD revision :one`;
  await db.send(new UpdateCommand({
    TableName: table,
    Key: { pk: match.pk, sk: "META" },
    UpdateExpression: update,
    ConditionExpression: "(#state = :lobby OR #state = :running) AND revision = :revision",
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
  const next = {
    ...match,
    revision: match.revision + 1,
    presence: { ...(match.presence || {}), [userId]: presence },
    ready: match.state === "lobby" && !connected
      ? { ...(match.ready || {}), [userId]: false }
      : match.ready,
  };
  return response(200, publicMatch(next, userId));
}

async function markReady(userId, match, operationId, mark, requestId) {
  if (match.state !== "lobby" || match.lobbyExpiresAt <= nowIso()) {
    return fail(409, "MATCH_CLOSED", "A partida não está aguardando largada.", requestId);
  }
  const readyAt = nowIso();
  const presence = {
    ...(match.presence || {}),
    [userId]: { lastSeenAt: readyAt, connected: true },
  };
  const ready = { ...(match.ready || {}), [userId]: true };
  const both = Boolean(match.guestUserId)
    && ready[match.hostUserId]
    && ready[match.guestUserId]
    && presence[match.hostUserId]?.connected
    && presence[match.guestUserId]?.connected
    && presenceFresh({ ...match, presence }, match.hostUserId)
    && presenceFresh({ ...match, presence }, match.guestUserId);
  const next = {
    ...match,
    presence,
    ready,
    state: both ? "running" : "lobby",
    startedAt: both ? readyAt : match.startedAt,
    revision: match.revision + 1,
  };
  const payload = publicMatch(next, userId);
  const items = [
    {
      Update: {
        TableName: table,
        Key: { pk: match.pk, sk: "META" },
        UpdateExpression: "SET ready = :ready, presence = :presence, #state = :state, startedAt = :startedAt, revision = revision + :one",
        ConditionExpression: "#state = :lobby AND revision = :revision AND lobbyExpiresAt > :now",
        ExpressionAttributeNames: { "#state": "state" },
        ExpressionAttributeValues: {
          ":ready": ready,
          ":presence": presence,
          ":state": next.state,
          ":startedAt": next.startedAt || null,
          ":one": 1,
          ":lobby": "lobby",
          ":revision": match.revision,
          ":now": nowIso(),
        },
      },
    },
    outboxPut(
      match.id,
      operationId,
      both ? "match.started" : "match.ready",
      [match.hostUserId, match.guestUserId],
      readyAt,
    ),
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
    : {
      winnerUserId: match.hostUserId === userId ? match.guestUserId : match.hostUserId,
      reason: "abandon",
      finishedAt,
    };
  const nextState = beforeStart ? "cancelled" : "finished";
  const resultStatus = beforeStart ? "cancelled" : "confirmed";
  const payload = publicMatch({
    ...match, state: nextState, result, resultStatus, revision: match.revision + 1,
  }, userId);
  const items = [
    {
      Update: {
        TableName: table,
        Key: { pk: match.pk, sk: "META" },
        UpdateExpression: "SET #state = :state, #result = :result, resultStatus = :resultStatus, finishedAt = :at, revision = revision + :one",
        ConditionExpression: "#state = :current AND revision = :revision",
        ExpressionAttributeNames: { "#state": "state", "#result": "result" },
        ExpressionAttributeValues: {
          ":state": nextState,
          ":result": result,
          ":resultStatus": resultStatus,
          ":at": finishedAt,
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
    outboxPut(
      match.id,
      operationId,
      beforeStart ? "match.cancelled" : "match.finished",
      [match.hostUserId, match.guestUserId],
      finishedAt,
      { winnerUserId: result?.winnerUserId || null, reason: result?.reason || "cancelled" },
    ),
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
            resultStatus,
          },
          ConditionExpression: "attribute_not_exists(pk)",
        },
      });
    }
  }
  await db.send(new TransactWriteCommand({ TransactItems: items }));
  return response(200, payload);
};

async function recoverMatch(userId, match, operationId, mark, requestId) {
  if (match.state !== "lobby" && match.state !== "running") {
    return response(200, publicMatch(match, userId));
  }
  const opponentId = participantIds(match).find((id) => id !== userId);
  if (opponentId && presenceFresh(match, opponentId)) {
    return fail(409, "MATCH_ACTIVE", "O outro participante ainda possui presença válida.", requestId);
  }
  if (match.state === "lobby") {
    return leaveMatch(userId, match, operationId, mark, requestId);
  }
  if (!opponentId || !awardDisconnectAllowed(match, userId)) {
    return fail(409, "MATCH_ACTIVE", "O outro participante ainda possui presença válida.", requestId);
  }

  const finishedAt = nowIso();
  const result = { winnerUserId: userId, reason: "abandon", finishedAt, rawTimeMs: null };
  const next = {
    ...match,
    state: "finished",
    result,
    resultStatus: "confirmed",
    revision: match.revision + 1,
  };
  const payload = publicMatch(next, userId);
  const participants = participantIds(match);
  await db.send(new TransactWriteCommand({ TransactItems: [
    {
      Update: {
        TableName: table,
        Key: { pk: match.pk, sk: "META" },
        UpdateExpression: "SET #state = :finished, #result = :result, resultStatus = :confirmed, finishedAt = :at, revision = revision + :one",
        ConditionExpression: "#state = :running AND revision = :revision AND presence.#opponent.lastSeenAt < :cutoff",
        ExpressionAttributeNames: { "#state": "state", "#result": "result", "#opponent": opponentId },
        ExpressionAttributeValues: {
          ":finished": "finished", ":running": "running", ":result": result,
          ":confirmed": "confirmed", ":at": finishedAt, ":one": 1,
          ":revision": match.revision,
          ":cutoff": new Date(Date.now() - PRESENCE_LEASE_MS).toISOString(),
        },
      },
    },
    ...participants.map((participant) => ({
      Delete: { TableName: table, Key: { pk: `USER#${participant}`, sk: "ACTIVE" } },
    })),
    ...participants.map((participant) => ({
      Put: {
        TableName: table,
        Item: {
          pk: `USER#${participant}`, sk: `RESULT#${finishedAt}#${match.id}`,
          matchId: match.id, at: finishedAt, result, resultStatus: "confirmed",
        },
        ConditionExpression: "attribute_not_exists(pk)",
      },
    })),
    outboxPut(match.id, operationId, "match.finished", participants, finishedAt, {
      winnerUserId: userId, reason: "abandon",
    }),
    operationPut(userId, operationId, mark, 200, payload),
  ] }));
  return response(200, payload);
}

async function awardDisconnect(userId, match, operationId, mark, requestId) {
  return recoverMatch(userId, match, operationId, mark, requestId);
}

async function finishMatch(userId, match, body, mark, requestId) {
  if (body.disconnect === true) return awardDisconnect(userId, match, body.operationId, mark, requestId);
  if (match.state === "finished") return response(200, publicMatch(match, userId));
  if (match.state !== "running" || !match.guestUserId) {
    return fail(409, "MATCH_CLOSED", "A partida não está em andamento.", requestId);
  }
  const ownResult = normalizeParticipant(body.result);
  const observedOpponent = normalizeParticipant(body.observedOpponent);
  if (!ownResult || !observedOpponent) {
    return fail(422, "INVALID_RESULT", "Resultado próprio ou confirmação do adversário inválido.", requestId);
  }
  const serverElapsedMs = Date.now() - Date.parse(match.startedAt || "");
  if (!ownResult.dnf && (!Number.isFinite(serverElapsedMs) || ownResult.rawTimeMs > serverElapsedMs + 2_500)) {
    return fail(422, "IMPOSSIBLE_TIME", "Tempo incompatível com o início registrado da corrida.", requestId);
  }
  if (match.submissions?.[userId]) {
    return response(200, publicMatch(match, userId));
  }
  const submittedAt = nowIso();
  const submissions = {
    ...(match.submissions || {}),
    [userId]: { result: ownResult, observedOpponent, submittedAt },
  };
  const participants = participantIds(match);
  const complete = participants.every((participant) => submissions[participant]);
  if (!complete) {
    const next = { ...match, submissions, resultStatus: "pending", revision: match.revision + 1 };
    const payload = publicMatch(next, userId);
    await db.send(new TransactWriteCommand({ TransactItems: [
      {
        Update: {
          TableName: table,
          Key: { pk: match.pk, sk: "META" },
          UpdateExpression: "SET submissions = :submissions, resultStatus = :pending, revision = revision + :one",
          ConditionExpression: "#state = :running AND revision = :revision",
          ExpressionAttributeNames: { "#state": "state" },
          ExpressionAttributeValues: {
            ":submissions": submissions, ":pending": "pending", ":one": 1,
            ":running": "running", ":revision": match.revision,
          },
        },
      },
      operationPut(userId, body.operationId, mark, 200, payload),
    ] }));
    return response(200, payload);
  }

  const confirmed = submissionsAgree(submissions, participants);
  const finishedAt = nowIso();
  const calculated = confirmed
    ? buildRaceResult(Object.fromEntries(participants.map((id) => [id, submissions[id].result])), participants, finishedAt)
    : null;
  const result = confirmed
    ? calculated.result
    : { winnerUserId: null, reason: "disputed", finishedAt };
  const resultStatus = confirmed ? "confirmed" : "disputed";
  const next = {
    ...match, submissions, state: "finished", result, resultStatus, revision: match.revision + 1,
  };
  const payload = publicMatch(next, userId);
  await db.send(new TransactWriteCommand({ TransactItems: [
    {
      Update: {
        TableName: table,
        Key: { pk: match.pk, sk: "META" },
        UpdateExpression: "SET submissions = :submissions, #state = :finished, #result = :result, resultStatus = :resultStatus, finishedAt = :at, revision = revision + :one",
        ConditionExpression: "#state = :running AND revision = :revision",
        ExpressionAttributeNames: { "#state": "state", "#result": "result" },
        ExpressionAttributeValues: {
          ":submissions": submissions, ":finished": "finished", ":running": "running",
          ":result": result, ":resultStatus": resultStatus, ":at": finishedAt,
          ":one": 1, ":revision": match.revision,
        },
      },
    },
    ...participants.map((participant) => ({
      Delete: { TableName: table, Key: { pk: `USER#${participant}`, sk: "ACTIVE" } },
    })),
    ...participants.map((participant) => ({
      Put: {
        TableName: table,
        Item: {
          pk: `USER#${participant}`, sk: `RESULT#${finishedAt}#${match.id}`,
          matchId: match.id, at: finishedAt, result, resultStatus,
        },
        ConditionExpression: "attribute_not_exists(pk)",
      },
    })),
    outboxPut(match.id, body.operationId, "match.finished", participants, finishedAt, {
      winnerUserId: result.winnerUserId, reason: result.reason, resultStatus,
    }),
    operationPut(userId, body.operationId, mark, 200, payload),
  ] }));
  return response(200, payload);
}
