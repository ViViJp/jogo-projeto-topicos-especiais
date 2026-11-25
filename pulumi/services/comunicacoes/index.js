const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const { randomUUID } = require("crypto");

let db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
let ses = new SESClient({});
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

const defaultPreferences = {
  categories: { welcome: true, campaign: true, ending: true, match: true },
  channels: { game: true, email: false },
  revision: 0,
};

exports.handler = async (event) => {
  if (Array.isArray(event.Records)) return consumeQueue(event.Records);
  if (!event.requestContext?.http && event.action === "events") return consumeEvents(event.events || []);
  if (!event.requestContext?.http && event.action === "welcome") return sendWelcome(event);

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
          ScanIndexForward: false,
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
      if (body.expectedRevision !== revision) {
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

async function sendWelcome(event) {
  const userId = event.userId || "";
  const email = event.email || "";
  const name = event.name || email || "jogador";
  if (!userId) return { notified: false, email: "skipped", attempts: 0 };
  await db.send(new PutCommand({
    TableName: table,
    Item: { pk: userId, sk: "CONTACT", email, name, updatedAt: new Date().toISOString() },
  }));
  const notified = await ensureNote(userId);
  const delivery = await deliverEmail(userId, email, name);
  return { notified, email: delivery.state, attempts: delivery.attempts };
}

async function consumeQueue(records) {
  const batchItemFailures = [];
  for (const record of records) {
    try {
      await consumeEvents([JSON.parse(record.body)]);
    } catch (err) {
      console.error("communication event ingestion failed", { errorName: err?.name || "Error" });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}

async function consumeEvents(events) {
  const processed = [];
  for (const event of events) {
    if (!event?.id || !event.type) continue;
    const recipients = [...new Set([event.userId, ...(event.userIds || [])].filter(Boolean))];
    if (event.type === "account.created") {
      await sendWelcome({
        userId: event.userId,
        email: event.detail?.email || "",
        name: event.detail?.name || "",
      });
      processed.push(event.id);
      continue;
    }
    for (const userId of recipients) {
      if (event.type.startsWith("campaign.") && event.detail?.milestoneKey) {
        const ending = event.detail.ending || "";
        const category = ending ? "ending" : "campaign";
        await ensureEventNote(
          userId,
          `${category}-${event.resource}-${event.detail.milestoneKey}`,
          category,
          ending ? `ending:${ending}` : `campaign:${event.detail.milestoneKey}`,
          event.at,
        );
        if (ending) await deliverEndingEmail(userId, ending);
        processed.push(`${userId}:${event.id}`);
      } else if (event.type === "match.finished") {
        await ensureEventNote(userId, `match-${event.resource}`, "match", `match:${event.resource}`, event.at);
        processed.push(`${userId}:${event.id}`);
      }
    }
  }
  return { processed };
}

async function ensureEventNote(userId, id, category, target, createdAt) {
  const storedPreferences = await db.send(
    new GetCommand({ TableName: table, Key: { pk: userId, sk: "PREFERENCES" } })
  );
  const preferences = storedPreferences.Item?.preferences || defaultPreferences;
  if (preferences.channels?.game === false || preferences.categories?.[category] === false) return false;
  const now = createdAt ? new Date(createdAt) : new Date();
  try {
    await db.send(new PutCommand({
      TableName: table,
      Item: {
        pk: userId,
        sk: `NOTE#${id}`,
        id,
        category,
        target,
        createdAt: now.toISOString(),
        readAt: null,
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      ConditionExpression: "attribute_not_exists(pk)",
    }));
    return true;
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") return true;
    throw err;
  }
}

async function deliverEndingEmail(userId, ending) {
  const preferences = await db.send(new GetCommand({ TableName: table, Key: { pk: userId, sk: "PREFERENCES" } }));
  const selected = preferences.Item?.preferences || defaultPreferences;
  if (!selected.channels?.email || !selected.categories?.ending) return { state: "skipped", attempts: 0 };
  const contact = await db.send(new GetCommand({ TableName: table, Key: { pk: userId, sk: "CONTACT" } }));
  const email = contact.Item?.email || "";
  const name = contact.Item?.name || "jogador";
  return deliverEmail(userId, email, name, {
    key: `ending#${ending}`,
    subject: "Final concluído em Flesh to Chrome",
    text: `Olá, ${name}. O final ${ending.toUpperCase()} foi concluído e registrado na sua campanha.`,
  });
}

async function ensureNote(userId) {
  const id = `welcome-${userId}`;
  const now = new Date();
  try {
    await db.send(
      new PutCommand({
        TableName: table,
        Item: {
          pk: userId,
          sk: `NOTE#${id}`,
          id,
          category: "welcome",
          target: "game",
          createdAt: now.toISOString(),
          readAt: null,
          expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        ConditionExpression: "attribute_not_exists(pk)",
      })
    );
    return true;
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") return true;
    console.error(err.name || "note");
    return false;
  }
}

async function deliverEmail(userId, email, name, template = {}) {
  const key = { pk: userId, sk: `EMAIL#${template.key || "welcome"}` };
  const current = (await db.send(new GetCommand({ TableName: table, Key: key }))).Item;
  const attempts = Number(current?.attempts || 0);
  if (["sent", "skipped", "suppressed", "uncertain"].includes(current?.state)) {
    return { state: current.state, attempts };
  }
  if (current?.state === "sending") {
    const age = Date.now() - Date.parse(current.updatedAt || "");
    if (Number.isNaN(age) || age < 60 * 1000) return { state: "sending", attempts };
    await markUncertain(key, current.attemptId || "", current.messageId || "", "stale-reservation");
    return { state: "uncertain", attempts };
  }
  if (attempts >= 5) return { state: "failed", attempts };
  const from = process.env.SES_FROM || "";
  if (!email) {
    await putDelivery(key, "skipped", attempts, "");
    return { state: "skipped", attempts };
  }
  if (!from) return { state: "pending", attempts };
  const reservation = await reserveSend(key, current);
  if (!reservation) return { state: "sending", attempts };
  const { attemptId, attempts: reservedAttempts } = reservation;
  let accepted;
  try {
    accepted = await ses.send(
      new SendEmailCommand({
        Source: from,
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: template.subject || "Bem-vindo ao Flesh to Chrome", Charset: "UTF-8" },
          Body: {
            Text: {
              Data: template.text || `Olá, ${name}. Sua conta foi criada. Se este e-mail falhar, o login continua valendo.`,
              Charset: "UTF-8",
            },
          },
        },
      })
    );
  } catch (err) {
    const state = classifySesFailure(err);
    if (state === "uncertain") {
      await markUncertain(key, attemptId, "", err.name || "send-uncertain");
    } else {
      const written = await finishSend(key, attemptId, state, err.name || "send", "");
      if (!written) {
        await markUncertain(key, attemptId, "", "delivery-state-not-confirmed");
        return { state: "uncertain", attempts: reservedAttempts };
      }
    }
    return { state, attempts: reservedAttempts };
  }
  const messageId = accepted?.MessageId || accepted?.messageId || "";
  const written = await finishSend(key, attemptId, "sent", "", messageId);
  if (!written) {
    await markUncertain(key, attemptId, messageId, "accepted-state-not-confirmed");
    return { state: "uncertain", attempts: reservedAttempts };
  }
  return { state: "sent", attempts: reservedAttempts };
}

async function reserveSend(key, current) {
  const now = new Date().toISOString();
  const observedAttempts = Number(current?.attempts || 0);
  if (observedAttempts >= 5) return null;
  const attemptId = randomUUID();
  try {
    if (!current) {
      await db.send(
        new PutCommand({
          TableName: table,
          Item: { ...key, state: "sending", attempts: 1, attemptId, messageId: "", lastError: "", updatedAt: now },
          ConditionExpression: "attribute_not_exists(pk)",
        })
      );
    } else {
      await db.send(
        new UpdateCommand({
          TableName: table,
          Key: key,
          UpdateExpression: "SET #state = :sending, attempts = if_not_exists(attempts, :zero) + :one, attemptId = :attemptId, messageId = :empty, lastError = :empty, updatedAt = :now",
          ConditionExpression: "#state = :previous AND (attribute_not_exists(attempts) OR attempts = :observed) AND (attribute_not_exists(attempts) OR attempts < :max)",
          ExpressionAttributeNames: { "#state": "state" },
          ExpressionAttributeValues: {
            ":sending": "sending",
            ":previous": current.state || "pending",
            ":observed": observedAttempts,
            ":zero": 0,
            ":one": 1,
            ":max": 5,
            ":attemptId": attemptId,
            ":empty": "",
            ":now": now,
          },
        })
      );
    }
    return { attemptId, attempts: observedAttempts + 1 };
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") return false;
    throw err;
  }
}

async function finishSend(key, attemptId, state, lastError, messageId) {
  try {
    await db.send(
      new UpdateCommand({
        TableName: table,
        Key: key,
        UpdateExpression: "SET #state = :state, lastError = :error, messageId = :messageId, updatedAt = :now",
        ConditionExpression: "#state = :sending AND attemptId = :attemptId",
        ExpressionAttributeNames: { "#state": "state" },
        ExpressionAttributeValues: {
          ":state": state,
          ":error": lastError,
          ":messageId": messageId,
          ":sending": "sending",
          ":attemptId": attemptId,
          ":now": new Date().toISOString(),
        },
      })
    );
    return true;
  } catch (err) {
    console.error(err.name || "email-finish");
    return false;
  }
}

async function markUncertain(key, attemptId, messageId, lastError) {
  const hasAttemptId = Boolean(attemptId);
  try {
    await db.send(
      new UpdateCommand({
        TableName: table,
        Key: key,
        UpdateExpression: "SET #state = :uncertain, messageId = :messageId, lastError = :error, updatedAt = :now",
        ConditionExpression: hasAttemptId
          ? "#state = :sending AND attemptId = :attemptId"
          : "#state = :sending AND attribute_not_exists(attemptId)",
        ExpressionAttributeNames: { "#state": "state" },
        ExpressionAttributeValues: {
          ":uncertain": "uncertain",
          ":sending": "sending",
          ...(hasAttemptId ? { ":attemptId": attemptId } : {}),
          ":messageId": messageId,
          ":error": lastError,
          ":now": new Date().toISOString(),
        },
      })
    );
  } catch (err) {
    if (err.name !== "ConditionalCheckFailedException") console.error(err.name || "uncertain");
  }
}

function classifySesFailure(err) {
  const permanent = new Set([
    "MessageRejected",
    "MailFromDomainNotVerifiedException",
    "ConfigurationSetDoesNotExistException",
    "AccountSendingPausedException",
  ]);
  if (permanent.has(err?.name)) return "suppressed";
  const status = Number(err?.$metadata?.httpStatusCode || 0);
  if (status === 429 || status >= 500) return "failed";
  if (status >= 400 && status < 500) return "suppressed";
  return "uncertain";
}

async function putDelivery(key, state, attempts, lastError) {
  await db.send(
    new PutCommand({
      TableName: table,
      Item: { ...key, state, attempts, lastError, updatedAt: new Date().toISOString() },
    })
  );
}

exports.__test = {
  classifySesFailure,
  deliverEmail,
  consumeEvents,
  reserveSend,
  setClients(nextDb, nextSes) {
    db = nextDb;
    ses = nextSes;
  },
};
