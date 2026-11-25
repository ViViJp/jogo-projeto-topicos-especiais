const assert = require("assert");
const Module = require("module");

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === "@aws-sdk/client-sqs") {
    return { SQSClient: class {}, SendMessageBatchCommand: class {} };
  }
  if (request === "@aws-sdk/util-dynamodb") {
    return {
      unmarshall(image) {
        return Object.fromEntries(Object.entries(image).map(([key, value]) => [key, value.S || value]));
      },
    };
  }
  return originalLoad(request, parent, isMain);
};
const { outboxEvents } = require("./index").__test;
Module._load = originalLoad;

const events = outboxEvents([
  {
    eventName: "INSERT",
    dynamodb: { NewImage: {
      pk: { S: "user" }, sk: { S: "OUTBOX#op" }, id: { S: "op" },
      type: { S: "campaign.saved" }, userId: { S: "user" },
    } },
  },
  { eventName: "MODIFY", dynamodb: { NewImage: { sk: { S: "OUTBOX#ignored" } } } },
  { eventName: "INSERT", dynamodb: { NewImage: { sk: { S: "CAMPAIGN" } } } },
]);
assert.equal(events.length, 1);
assert.equal(events[0].id, "op");
assert.equal(events[0].pk, undefined);
assert.equal(events[0].sk, undefined);

console.log("outbox publisher: filtro e envelope OK");
