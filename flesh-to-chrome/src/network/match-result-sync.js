const NOTICE = "RESULTADO AINDA NÃO CONFIRMADO";

function enqueueResult(queue, job) {
  if (queue.some((item) => item.operationId === job.operationId)) return queue;
  return queue.concat({
    kind: job.kind,
    matchId: job.matchId,
    operationId: job.operationId,
    result: job.result || null,
    observedOpponent: job.observedOpponent || null,
    failures: 0,
    sceneClosed: false,
    notice: NOTICE,
  });
}

function markSceneClosed(queue) {
  return queue.map((job) => ({ ...job, sceneClosed: true, notice: NOTICE }));
}

function markFailure(queue, operationId) {
  return queue.map((job) => (
    job.operationId === operationId
      ? { ...job, failures: job.failures + 1, notice: NOTICE }
      : job
  ));
}

function markConfirmed(queue, operationId) {
  return queue.filter((job) => job.operationId !== operationId);
}

function pendingNotice(queue) {
  return queue[0]?.notice || null;
}

function retryDelay(failures, opponentStillPresent) {
  if (opponentStillPresent) return 15_000;
  return Math.min(8_000, 500 * (2 ** Math.max(0, failures - 1)));
}

module.exports = {
  enqueueResult,
  markConfirmed,
  markFailure,
  markSceneClosed,
  pendingNotice,
  retryDelay,
};
