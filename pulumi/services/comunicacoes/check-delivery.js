const assert = require("assert");
const Module = require("module");

function command(name) {
  return { [name]: class { constructor(input) { this.input = input; } } }[name];
}

const GetCommand = command("GetCommand");
const PutCommand = command("PutCommand");
const UpdateCommand = command("UpdateCommand");
const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === "@aws-sdk/client-dynamodb") return { DynamoDBClient: class {} };
  if (request === "@aws-sdk/client-ses") {
    return { SESClient: class {}, SendEmailCommand: command("SendEmailCommand") };
  }
  if (request === "@aws-sdk/lib-dynamodb") {
    return {
      DynamoDBDocumentClient: { from: () => ({ send: async () => ({}) }) },
      GetCommand,
      PutCommand,
      QueryCommand: command("QueryCommand"),
      UpdateCommand,
    };
  }
  return originalLoad(request, parent, isMain);
};
const communications = require("./index").__test;
Module._load = originalLoad;

function conditionalFailure() {
  const error = new Error("conditional");
  error.name = "ConditionalCheckFailedException";
  throw error;
}

class FakeDb {
  constructor(item = null, failSentOnce = false) {
    this.item = item ? { ...item } : null;
    this.failSentOnce = failSentOnce;
  }

  async send(commandValue) {
    const input = commandValue.input;
    if (commandValue instanceof GetCommand) return { Item: this.item ? { ...this.item } : undefined };
    if (commandValue instanceof PutCommand) {
      if (this.item) conditionalFailure();
      this.item = { ...input.Item };
      return {};
    }
    if (!(commandValue instanceof UpdateCommand) || !this.item) conditionalFailure();
    const values = input.ExpressionAttributeValues;
    if (values[":previous"] !== undefined) {
      if (
        this.item.state !== values[":previous"] ||
        Number(this.item.attempts || 0) !== values[":observed"] ||
        Number(this.item.attempts || 0) >= values[":max"]
      ) conditionalFailure();
      this.item = {
        ...this.item,
        state: "sending",
        attempts: Number(this.item.attempts || 0) + 1,
        attemptId: values[":attemptId"],
        messageId: "",
        lastError: "",
        updatedAt: values[":now"],
      };
      return {};
    }
    const attemptMatches = values[":attemptId"] === undefined
      ? this.item.attemptId === undefined
      : this.item.attemptId === values[":attemptId"];
    if (this.item.state !== "sending" || !attemptMatches) conditionalFailure();
    if (values[":state"] === "sent" && this.failSentOnce) {
      this.failSentOnce = false;
      throw Object.assign(new Error("storage unavailable"), { name: "StorageUnavailable" });
    }
    this.item = {
      ...this.item,
      state: values[":state"] || values[":uncertain"],
      messageId: values[":messageId"],
      lastError: values[":error"],
      updatedAt: values[":now"],
    };
    return {};
  }
}

class EventDb {
  constructor() { this.items = new Map(); }
  key(value) { return `${value.pk}|${value.sk}`; }
  async send(commandValue) {
    const input = commandValue.input;
    if (commandValue instanceof GetCommand) return { Item: this.items.get(this.key(input.Key)) };
    if (commandValue instanceof PutCommand) {
      const key = this.key(input.Item);
      if (input.ConditionExpression && this.items.has(key)) conditionalFailure();
      this.items.set(key, { ...input.Item });
      return {};
    }
    conditionalFailure();
  }
}

(async () => {
  const db = new FakeDb({ pk: "u", sk: "EMAIL#welcome", state: "failed", attempts: 4 });
  communications.setClients(db, { send: async () => ({ MessageId: "m-1" }) });
  const staleRead = { ...db.item };
  const reservations = await Promise.all([
    communications.reserveSend({ pk: "u", sk: "EMAIL#welcome" }, staleRead),
    communications.reserveSend({ pk: "u", sk: "EMAIL#welcome" }, staleRead),
  ]);
  assert.equal(reservations.filter(Boolean).length, 1);
  assert.equal(db.item.attempts, 5);
  assert.ok(db.item.attemptId);
  assert.equal(await communications.reserveSend(
    { pk: "u", sk: "EMAIL#welcome" },
    { ...db.item },
  ), null);

  const outdated = new FakeDb({ pk: "u", sk: "EMAIL#welcome", state: "failed", attempts: 4 });
  communications.setClients(outdated, { send: async () => ({}) });
  const rejected = await communications.reserveSend(
    { pk: "u", sk: "EMAIL#welcome" },
    { pk: "u", sk: "EMAIL#welcome", state: "failed", attempts: 1 },
  );
  assert.equal(rejected, false);
  assert.equal(outdated.item.attempts, 4);

  assert.equal(communications.classifySesFailure({ name: "MessageRejected" }), "suppressed");
  assert.equal(communications.classifySesFailure({ name: "ServiceUnavailable", $metadata: { httpStatusCode: 503 } }), "failed");
  assert.equal(communications.classifySesFailure({ name: "TimeoutError" }), "uncertain");

  process.env.SES_FROM = "verified@example.com";
  const uncertain = new FakeDb();
  communications.setClients(uncertain, { send: async () => { throw Object.assign(new Error("timeout"), { name: "TimeoutError" }); } });
  const result = await communications.deliverEmail("user-timeout", "player@example.com", "Alex");
  assert.equal(result.state, "uncertain");
  assert.equal(uncertain.item.state, "uncertain");
  assert.equal(uncertain.item.attempts, 1);
  assert.ok(uncertain.item.attemptId);

  const accepted = new FakeDb();
  communications.setClients(accepted, { send: async () => ({ MessageId: "ses-message-1" }) });
  const sent = await communications.deliverEmail("user-sent", "player@example.com", "Alex");
  assert.equal(sent.state, "sent");
  assert.equal(accepted.item.messageId, "ses-message-1");

  const persistenceFailure = new FakeDb(null, true);
  communications.setClients(persistenceFailure, { send: async () => ({ MessageId: "ses-message-2" }) });
  const originalError = console.error;
  console.error = () => undefined;
  const uncertainAfterAccept = await communications.deliverEmail("user-accepted", "player@example.com", "Alex");
  console.error = originalError;
  assert.equal(uncertainAfterAccept.state, "uncertain");
  assert.equal(persistenceFailure.item.state, "uncertain");
  assert.equal(persistenceFailure.item.messageId, "ses-message-2");

  const eventDb = new EventDb();
  communications.setClients(eventDb, { send: async () => ({ MessageId: "unused" }) });
  const campaignEvent = {
    id: "campaign-op-1",
    userId: "player-1",
    type: "campaign.saved",
    resource: "campaign-player-1",
    at: "2026-11-25T12:00:00.000Z",
    detail: { milestoneKey: "implant-1", ending: null },
  };
  await communications.consumeEvents([campaignEvent, campaignEvent]);
  assert.equal(
    [...eventDb.items.values()].filter((item) => item.sk?.startsWith("NOTE#campaign-")).length,
    1,
    "replay do mesmo marco não pode duplicar notificação",
  );
  await communications.consumeEvents([{
    id: "match-op-1",
    userIds: ["player-1", "player-2"],
    type: "match.finished",
    resource: "match-1",
    at: "2026-11-25T12:10:00.000Z",
  }]);
  assert.ok(eventDb.items.has("player-1|NOTE#match-match-1"));
  assert.ok(eventDb.items.has("player-2|NOTE#match-match-1"));

  console.log("communications delivery ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
