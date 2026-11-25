const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} = require("@aws-sdk/lib-dynamodb");

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const table = process.env.TABLE_NAME;
const connectionTtlSeconds = 2 * 60 * 60;

function ok() {
  return { statusCode: 200, body: "" };
}

function reject(statusCode, message) {
  return { statusCode, body: JSON.stringify({ error: message }) };
}

function connectionKey(connectionId) {
  return { pk: `CONNECTION#${connectionId}`, sk: "META" };
}

function validIdentifier(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
}

function isRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function validDescription(value, type) {
  return isRecord(value) && value.type === type && typeof value.sdp === "string"
    && value.sdp.length > 0 && value.sdp.length <= 30 * 1024;
}

function validCandidate(value) {
  return isRecord(value) && typeof value.candidate === "string" && value.candidate.length <= 4096;
}

function parseEnvelope(body) {
  let value;
  try {
    value = JSON.parse(body || "");
  } catch {
    return null;
  }
  if (!isRecord(value) || !validIdentifier(value.roomId) || !validIdentifier(value.from)) return null;
  if (value.to !== undefined && !validIdentifier(value.to)) return null;
  if (!isRecord(value.signal)) return null;
  const type = value.signal.type;
  if (type === "presence" && typeof value.signal.requestReply === "boolean") return value;
  if (type === "offer" && validDescription(value.signal.description, "offer")) return value;
  if (type === "answer" && validDescription(value.signal.description, "answer")) return value;
  if (type === "ice-candidate" && validCandidate(value.signal.candidate)) return value;
  if (type === "leave") return value;
  return null;
}

function managementClient(event) {
  const domain = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  return new ApiGatewayManagementApiClient({ endpoint: `https://${domain}/${stage}` });
}

async function register(connectionId, envelope) {
  const current = (await db.send(new GetCommand({ TableName: table, Key: connectionKey(connectionId) }))).Item;
  if (!current) throw Object.assign(new Error("connection missing"), { name: "RejectedConnection" });
  if (current.roomId || current.peerId) {
    if (current.roomId !== envelope.roomId || current.peerId !== envelope.from) {
      throw Object.assign(new Error("identity changed"), { name: "RejectedConnection" });
    }
    return current;
  }
  if (envelope.signal.type !== "presence") {
    throw Object.assign(new Error("presence required"), { name: "RejectedConnection" });
  }
  const ttl = Math.floor(Date.now() / 1000) + connectionTtlSeconds;
  for (const slot of [0, 1]) {
    try {
      await db.send(new TransactWriteCommand({ TransactItems: [
        {
          Put: {
            TableName: table,
            Item: {
              pk: `ROOM#${envelope.roomId}`, sk: `PEER#${envelope.from}`,
              connectionId, peerId: envelope.from, slot, ttl,
            },
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
        {
          Put: {
            TableName: table,
            Item: {
              pk: `ROOM#${envelope.roomId}`, sk: `SLOT#${slot}`,
              connectionId, peerId: envelope.from, ttl,
            },
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
        {
          Update: {
            TableName: table,
            Key: connectionKey(connectionId),
            UpdateExpression: "SET roomId = :room, peerId = :peer, slot = :slot, ttl = :ttl",
            ConditionExpression: "attribute_not_exists(roomId) AND attribute_exists(pk)",
            ExpressionAttributeValues: {
              ":room": envelope.roomId, ":peer": envelope.from, ":slot": slot, ":ttl": ttl,
            },
          },
        },
      ] }));
      return { ...current, roomId: envelope.roomId, peerId: envelope.from, slot };
    } catch (error) {
      if (error?.name !== "TransactionCanceledException") throw error;
    }
  }
  throw Object.assign(new Error("room full or peer duplicated"), { name: "RejectedConnection" });
}

async function roomPeers(roomId) {
  const out = await db.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: "pk = :pk AND begins_with(sk, :peer)",
    ExpressionAttributeValues: { ":pk": `ROOM#${roomId}`, ":peer": "PEER#" },
  }));
  return out.Items || [];
}

async function relay(event, connectionId, envelope) {
  const api = managementClient(event);
  const peers = await roomPeers(envelope.roomId);
  await Promise.all(peers
    .filter((peer) => peer.connectionId !== connectionId && (!envelope.to || peer.peerId === envelope.to))
    .map(async (peer) => {
      try {
        await api.send(new PostToConnectionCommand({
          ConnectionId: peer.connectionId,
          Data: Buffer.from(JSON.stringify(envelope)),
        }));
      } catch (error) {
        if (error?.name === "GoneException") await removeConnection(peer.connectionId, peer);
        else throw error;
      }
    }));
}

async function removeConnection(connectionId, known) {
  const item = known?.roomId
    ? known
    : (await db.send(new GetCommand({ TableName: table, Key: connectionKey(connectionId) }))).Item;
  if (!item?.roomId || !item?.peerId || !Number.isInteger(item.slot)) {
    await db.send(new DeleteCommand({ TableName: table, Key: connectionKey(connectionId) }));
    return item || null;
  }
  try {
    await db.send(new TransactWriteCommand({ TransactItems: [
      { Delete: { TableName: table, Key: connectionKey(connectionId) } },
      {
        Delete: {
          TableName: table,
          Key: { pk: `ROOM#${item.roomId}`, sk: `PEER#${item.peerId}` },
          ConditionExpression: "connectionId = :connection",
          ExpressionAttributeValues: { ":connection": connectionId },
        },
      },
      {
        Delete: {
          TableName: table,
          Key: { pk: `ROOM#${item.roomId}`, sk: `SLOT#${item.slot}` },
          ConditionExpression: "connectionId = :connection",
          ExpressionAttributeValues: { ":connection": connectionId },
        },
      },
    ] }));
  } catch (error) {
    if (error?.name !== "TransactionCanceledException") throw error;
  }
  return item;
}

exports.handler = async (event) => {
  const route = event.requestContext?.routeKey;
  const connectionId = event.requestContext?.connectionId;
  if (!connectionId) return reject(400, "connection missing");
  try {
    if (route === "$connect") {
      const ttl = Math.floor(Date.now() / 1000) + connectionTtlSeconds;
      await db.send(new TransactWriteCommand({ TransactItems: [{
        Put: {
          TableName: table,
          Item: { ...connectionKey(connectionId), ttl },
          ConditionExpression: "attribute_not_exists(pk)",
        },
      }] }));
      return ok();
    }
    if (route === "$disconnect") {
      const removed = await removeConnection(connectionId);
      if (removed?.roomId && removed?.peerId) {
        await relay(event, connectionId, {
          roomId: removed.roomId,
          from: removed.peerId,
          signal: { type: "leave" },
        });
      }
      return ok();
    }
    const envelope = parseEnvelope(event.body);
    if (!envelope) return reject(400, "invalid signaling envelope");
    await register(connectionId, envelope);
    await relay(event, connectionId, envelope);
    return ok();
  } catch (error) {
    if (error?.name === "RejectedConnection" || error?.name === "TransactionCanceledException") {
      return reject(409, "room or identity rejected");
    }
    console.error("signaling failure", { errorName: error?.name || "Error" });
    return reject(503, "signaling unavailable");
  }
};

exports.__test = { parseEnvelope };
