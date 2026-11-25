const assert = require("assert");
const Module = require("module");

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === "@aws-sdk/client-apigatewaymanagementapi") {
    return { ApiGatewayManagementApiClient: class {}, PostToConnectionCommand: class {} };
  }
  if (request === "@aws-sdk/client-dynamodb") return { DynamoDBClient: class {} };
  if (request === "@aws-sdk/lib-dynamodb") {
    return {
      DynamoDBDocumentClient: { from: () => ({}) },
      DeleteCommand: class {}, GetCommand: class {}, QueryCommand: class {}, TransactWriteCommand: class {},
    };
  }
  return originalLoad(request, parent, isMain);
};
const { parseEnvelope } = require("./index").__test;
Module._load = originalLoad;

const presence = parseEnvelope(JSON.stringify({
  roomId: "room-1", from: "peer_a", signal: { type: "presence", requestReply: true },
}));
assert.equal(presence.roomId, "room-1");
assert.equal(parseEnvelope(JSON.stringify({ ...presence, roomId: "../invalid" })), null);
assert.equal(parseEnvelope(JSON.stringify({
  roomId: "room-1", from: "peer_a", signal: { type: "offer", description: { type: "answer", sdp: "v=0" } },
})), null);

console.log("signaling: envelope e limites OK");
