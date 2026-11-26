const assert = require("assert");
const {
  enqueueResult,
  markConfirmed,
  markFailure,
  markSceneClosed,
  pendingNotice,
} = require("./match-result-sync");

const job = { kind: "disconnect", matchId: "match-1", operationId: "op-1" };
let queue = enqueueResult([], job);
queue = markFailure(queue, "op-1");
queue = markSceneClosed(queue);

assert.equal(queue.length, 1, "voltar ao menu não apaga a tentativa");
assert.equal(queue[0].operationId, "op-1");
assert.equal(queue[0].sceneClosed, true);
assert.equal(queue[0].failures, 1);
assert.equal(pendingNotice(queue), "RESULTADO AINDA NÃO CONFIRMADO");
queue = enqueueResult(queue, job);
assert.equal(queue.length, 1, "o mesmo operationId não entra duas vezes");
queue = markConfirmed(queue, "op-1");
assert.equal(queue.length, 0);
assert.equal(pendingNotice(queue), null);

console.log("match result sync: falha de rede e retorno ao menu OK");
