const NOTICE = "RESULTADO AINDA NÃO CONFIRMADO";
const REJECTED_NOTICE = "RESULTADO REJEITADO";

function enqueueResult(queue, job) {
  if (!job.ownerId) return queue;
  if (queue.some((item) => item.ownerId === job.ownerId && item.operationId === job.operationId)) return queue;
  return queue.concat({
    kind: job.kind,
    matchId: job.matchId,
    operationId: job.operationId,
    ownerId: job.ownerId,
    result: job.result || null,
    observedOpponent: job.observedOpponent || null,
    failures: 0,
    sceneClosed: false,
    status: "pending",
    notice: NOTICE,
    rejectedReason: null,
  });
}

function markSceneClosed(queue) {
  return queue.map((job) => (
    job.status === "rejected" ? job : { ...job, sceneClosed: true, notice: NOTICE }
  ));
}

function markFailure(queue, operationId, ownerId) {
  return queue.map((job) => (
    job.ownerId === ownerId && job.operationId === operationId && job.status === "pending"
      ? { ...job, failures: job.failures + 1, notice: NOTICE }
      : job
  ));
}

function markRejected(queue, operationId, ownerId, reason) {
  return queue.map((job) => (
    job.ownerId === ownerId && job.operationId === operationId && job.status === "pending"
      ? { ...job, status: "rejected", notice: REJECTED_NOTICE, rejectedReason: reason || "invalid" }
      : job
  ));
}

function markConfirmed(queue, operationId, ownerId) {
  return queue.filter((job) => !(job.ownerId === ownerId && job.operationId === operationId));
}

function pendingNotice(queue) {
  return queue.find((job) => job.status === "pending")?.notice || null;
}

function selectForSend(queue, activeOwnerId) {
  if (!activeOwnerId) return null;
  return queue.find((job) => job.status === "pending" && job.ownerId === activeOwnerId) || null;
}

function retryDelay(failures, opponentStillPresent) {
  if (opponentStillPresent) return 15_000;
  return Math.min(8_000, 500 * (2 ** Math.max(0, failures - 1)));
}

function attemptDisposition(status) {
  if (status === "ok") return "confirmed";
  if (status === "invalid") return "permanent";
  return "temporary";
}

module.exports = {
  attemptDisposition,
  enqueueResult,
  markConfirmed,
  markFailure,
  markRejected,
  markSceneClosed,
  pendingNotice,
  retryDelay,
  selectForSend,
};
