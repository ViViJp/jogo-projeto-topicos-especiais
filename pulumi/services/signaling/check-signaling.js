const assert = require("assert");
const Module = require("module");

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === "@aws-sdk/client-apigatewaymanagementapi") {
    return { ApiGatewayManagementApiClient: class {}, PostToConnectionCommand: class {} };
  }
  if (request === "@aws-sdk/client-dynamodb") return { DynamoDBClient: class {} };
  if (request === "@aws-sdk/client-lambda") return { LambdaClient: class {}, InvokeCommand: class {} };
  if (request === "@aws-sdk/lib-dynamodb") {
    return {
      DynamoDBDocumentClient: { from: () => ({}) },
      DeleteCommand: class {}, GetCommand: class {}, QueryCommand: class {}, TransactWriteCommand: class {},
    };
  }
  return originalLoad(request, parent, isMain);
};
const { authorizeIdentity, claimSlot, disconnectMayRelease, replacementPlan } = require("./access");
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

assert.equal(authorizeIdentity(null, presence), false, "conexão sem autenticação não entra");
assert.equal(authorizeIdentity({ userId: "host", matchId: "room-1" }, presence), false, "o cliente não escolhe a identidade");
assert.equal(authorizeIdentity({ userId: "peer_a", matchId: "room-1" }, presence), true);
assert.equal(claimSlot([0, 1]), null, "a terceira vaga é recusada");
assert.equal(claimSlot([0]), 1);

const now = 1_700_000_000;
const live = (peerId, connectionId, slot) => ({ peerId, connectionId, slot, expiresAt: now + 60 });
assert.equal(replacementPlan([live("a", "old", 0), live("b", "b1", 1)], live("a", "old", 0), "c", now), null);
const replaced = replacementPlan([live("a", "old", 0), live("b", "b1", 1)], live("a", "old", 0), "a", now);
assert.equal(replaced.slot, 0, "reconexão reaproveita a vaga do mesmo jogador");
assert.equal(replaced.previousConnectionId, "old");
assert.equal(replaced.displacedPeerId, null);
const expired = replacementPlan(
  [{ peerId: "a", connectionId: "old", slot: 0, expiresAt: now - 1 }, live("b", "b1", 1)],
  null,
  "c",
  now,
);
assert.equal(expired.slot, 0, "vaga expirada não bloqueia outra conexão");
assert.equal(expired.displacedPeerId, "a");
assert.equal(disconnectMayRelease({ connectionId: "new" }, "old"), false, "queda antiga não remove a conexão nova");
assert.equal(disconnectMayRelease({ connectionId: "old" }, "old"), true);

console.log("signaling: envelope e limites OK");
