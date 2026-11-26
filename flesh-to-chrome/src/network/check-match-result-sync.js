const assert = require("assert");
const {
  LEGACY_NOTICE,
  applyAttempt,
  attemptDisposition,
  enqueueResult,
  finishPump,
  markFailure,
  markSceneClosed,
  mergeStores,
  migrateStore,
  pendingNotice,
  releaseOwnerListeners,
  requestPump,
  selectForSend,
  statusNotice,
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

queue = applyAttempt(queue, selectForSend(queue, "conta-a"), { status: "ok", state: "finished" }).queue;
assert.equal(selectForSend(queue, "conta-a"), null);
assert.equal(selectForSend(queue, "conta-b").operationId, "op-b");

function twoMatches(kind = "finish") {
  return enqueueResult(
    enqueueResult([], { kind, matchId: "match-1", operationId: "op-1", ownerId: "conta-a" }),
    { kind: "finish", matchId: "match-2", operationId: "op-2", ownerId: "conta-a" },
  );
}

function firstBlocksSecond(response) {
  const initial = twoMatches(response.state === "cancelled" ? "disconnect" : "finish");
  const head = selectForSend(initial, "conta-a");
  const applied = applyAttempt(initial, head, response);
  assert.equal(applied.disposition, "permanent", response.code || response.state);
  assert.equal(applied.queue.find((item) => item.operationId === "op-1").status, "rejected");
  assert.equal(selectForSend(applied.queue, "conta-a").operationId, "op-2");
}

for (const response of [
  { status: "conflict", code: "MATCH_CLOSED" },
  { status: "conflict", code: "OPERATION_CONFLICT" },
  { status: "unauthenticated", code: "FORBIDDEN" },
  { status: "ok", state: "cancelled" },
]) firstBlocksSecond(response);

const active = twoMatches();
const waiting = applyAttempt(active, selectForSend(active, "conta-a"), { status: "conflict", code: "MATCH_ACTIVE" });
assert.equal(waiting.disposition, "temporary");
assert.equal(selectForSend(waiting.queue, "conta-a").operationId, "op-1");
assert.equal(attemptDisposition("unavailable"), "temporary");
const closed = applyAttempt(twoMatches(), selectForSend(twoMatches(), "conta-a"), { status: "conflict", code: "MATCH_CLOSED" }).queue;
assert.match(statusNotice(closed), /RESULTADO REJEITADO match-1: MATCH_CLOSED/);

const migrated = migrateStore([
  { kind: "finish", matchId: "match-old", operationId: "op-old" },
  { kind: "finish", matchId: "match-a", operationId: "op-a", ownerId: "conta-a" },
]);
assert.equal(migrated.__legacy.length, 1, "operação antiga sem conta permanece preservada");
assert.equal(migrated.__legacy[0].notice, LEGACY_NOTICE);
assert.equal(selectForSend(migrated.__legacy, "conta-b"), null);
assert.equal(selectForSend(migrated["conta-a"], "conta-a").operationId, "op-a");

const memory = { "conta-a": [{ ...job, status: "pending", failures: 1 }] };
assert.equal(mergeStores(memory, {})["conta-a"][0].operationId, "op-1");

let gate = requestPump({ pumping: false, pending: [] }, { ownerId: "conta-a", delay: 0 });
assert.equal(gate.start.ownerId, "conta-a");
gate = requestPump({ pumping: true, pending: [] }, { ownerId: "conta-b", delay: 0 });
assert.equal(gate.start, null, "pedido durante a requisição não dispara outra chamada");
assert.equal(gate.pending[0].ownerId, "conta-b");
gate = requestPump(gate, { ownerId: "conta-a", delay: 15_000, retry: true });
gate = finishPump(gate);
assert.equal(gate.start.ownerId, "conta-b", "a fila da conta nova é retomada ao final");
assert.equal(gate.pending[0].ownerId, "conta-a");
assert.equal(gate.pending[0].delay, 15_000, "o intervalo da conta anterior continua valendo");
assert.deepEqual(releaseOwnerListeners(["conta-a:op-1", "conta-b:op-2"], "conta-a"), ["conta-b:op-2"]);

console.log("match result sync: erros definitivos, troca de conta e fila seguinte OK");
