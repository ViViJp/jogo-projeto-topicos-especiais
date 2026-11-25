const { SQSClient, SendMessageBatchCommand } = require("@aws-sdk/client-sqs");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const sqs = new SQSClient({});
const auditQueueUrl = process.env.AUDIT_QUEUE_URL || "";
const communicationsQueueUrl = process.env.COMMUNICATIONS_QUEUE_URL || "";
const communicationTypes = new Set(["account.created", "campaign.saved", "campaign.restored", "match.finished"]);

function outboxEvents(records) {
  return records
    .filter((record) => record.eventName === "INSERT" && record.dynamodb?.NewImage)
    .map((record) => unmarshall(record.dynamodb.NewImage))
    .filter((item) => typeof item.sk === "string" && item.sk.startsWith("OUTBOX#") && item.id && item.type)
    .map(({ pk: _pk, sk: _sk, ...event }) => event);
}

async function sendBatch(queueUrl, events) {
  if (!queueUrl || !events.length) return;
  for (let offset = 0; offset < events.length; offset += 10) {
    const entries = events.slice(offset, offset + 10).map((event, index) => ({
      Id: `${offset + index}`,
      MessageBody: JSON.stringify(event),
    }));
    const sent = await sqs.send(new SendMessageBatchCommand({ QueueUrl: queueUrl, Entries: entries }));
    if (sent.Failed?.length) {
      const error = new Error("SQS batch partially rejected");
      error.name = "EventPublishFailure";
      throw error;
    }
  }
}

exports.handler = async (event) => {
  const events = outboxEvents(event.Records || []);
  await Promise.all([
    sendBatch(auditQueueUrl, events),
    sendBatch(communicationsQueueUrl, events.filter((entry) => communicationTypes.has(entry.type))),
  ]);
  return { published: events.length };
};

exports.__test = { outboxEvents };
