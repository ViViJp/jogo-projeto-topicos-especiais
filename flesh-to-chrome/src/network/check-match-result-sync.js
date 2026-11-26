const assert = require("assert");
const {
  attemptDisposition,
  enqueueResult,
  markConfirmed,
  markFailure,
  markRejected,
  markSceneClosed,
  pendingNotice,
  selectForSend,
} = require("./match-result-sync");

const job = { kind: "disconnect", matchId: "match-1", operationId: "op-1", ownerId: "conta-a" };
let queue = enqueueResult([], job);
queue = markFailure(queue, "op-1", "conta-a");
queue = markSceneClosed(queue);

assert.equal(queue.length, 1, "voltar ao menu não apaga a tentativa");
assert.equal(queue[0].operationId, "op-1");
assert.equal(queue[0].ownerId, "conta-a");
assert.equal(queue[0].sceneClosed, true);
assert.equal(queue[0].failures, 1);
assert.equal(pendingNotice(queue), "RESULTADO AINDA NÃO CONFIRMADO");
queue = enqueueResult(queue, job);
assert.equal(queue.length, 1, "o mesmo operationId não entra duas vezes");
assert.equal(selectForSend(queue, "conta-b"), null, "a conta B não envia a operação da conta A");
assert.equal(selectForSend(queue, null), null);
assert.equal(selectForSend(queue, "conta-a").operationId, "op-1");
queue = enqueueResult(queue, { kind: "finish", matchId: "match-b", operationId: "op-b", ownerId: "conta-b" });
assert.equal(selectForSend(queue, "conta-b").operationId, "op-b");
assert.equal(queue.filter((item) => item.ownerId === "conta-a").length, 1, "a operação da conta A permanece preservada");

queue = markConfirmed(queue, "op-1", "conta-a");
assert.equal(selectForSend(queue, "conta-a"), null);
assert.equal(selectForSend(queue, "conta-b").operationId, "op-b");

let blocked = enqueueResult([], { kind: "finish", matchId: "match-1", operationId: "op-1", ownerId: "conta-a" });
blocked = enqueueResult(blocked, { kind: "finish", matchId: "match-2", operationId: "op-2", ownerId: "conta-a" });
assert.equal(attemptDisposition("invalid"), "permanent");
assert.equal(attemptDisposition("unavailable"), "temporary");
blocked = markRejected(blocked, "op-1", "conta-a", "invalid");
assert.equal(blocked.find((item) => item.operationId === "op-1").status, "rejected");
assert.equal(selectForSend(blocked, "conta-a").operationId, "op-2", "a segunda partida segue depois do erro definitivo");

console.log("match result sync: troca de conta e erro definitivo OK");
