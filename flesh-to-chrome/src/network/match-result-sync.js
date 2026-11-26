const NOTICE = "RESULTADO AINDA NÃO CONFIRMADO";
const REJECTED_NOTICE = "RESULTADO REJEITADO";
const LEGACY_NOTICE = "RESULTADO ANTIGO SEM CONTA — NÃO REENVIADO";

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
    failures: job.failures || 0,
    sceneClosed: Boolean(job.sceneClosed),
    status: job.status === "rejected" ? "rejected" : "pending",
    notice: job.status === "rejected" ? REJECTED_NOTICE : NOTICE,
    rejectedReason: job.rejectedReason || null,
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

function statusNotice(queue) {
  const lines = [];
  const pending = pendingNotice(queue);
  if (pending) lines.push(pending);
  for (const job of queue.filter((item) => item.status === "rejected")) {
    lines.push(`RESULTADO REJEITADO ${String(job.matchId).slice(0, 8)}: ${job.rejectedReason}`);
  }
  return lines.join("\n") || null;
}

function selectForSend(queue, activeOwnerId) {
  if (!activeOwnerId) return null;
  return queue.find((job) => job.status === "pending" && job.ownerId === activeOwnerId) || null;
}

function retryDelay(failures, opponentStillPresent) {
  if (opponentStillPresent) return 15_000;
  return Math.min(8_000, 500 * (2 ** Math.max(0, failures - 1)));
}

function attemptDisposition(response, kind) {
  const status = typeof response === "string" ? response : response?.status;
  const code = typeof response === "string" ? null : response?.code || null;
  const state = typeof response === "string" ? null : response?.state || response?.value?.state || null;
  if (code === "MATCH_ACTIVE" || code === "MATCH_CONFLICT") return "temporary";
  if (code === "MATCH_CLOSED" || code === "OPERATION_CONFLICT" || code === "FORBIDDEN") return "permanent";
  if (status === "invalid") return "permanent";
  if (status === "ok" && kind === "disconnect" && state === "cancelled") return "permanent";
  if (status === "ok" && kind === "disconnect" && state === "finished") return "confirmed";
  if (status === "ok" && kind === "finish") return "confirmed";
  if (status === "ok") return "temporary";
  return "temporary";
}

function applyAttempt(queue, job, response) {
  const disposition = attemptDisposition(response, job.kind);
  if (disposition === "confirmed") {
    return { disposition, queue: markConfirmed(queue, job.operationId, job.ownerId) };
  }
  if (disposition === "permanent") {
    const reason = response?.code || response?.state || (response?.value?.state === "cancelled" ? "cancelled" : "invalid");
    return { disposition, queue: markRejected(queue, job.operationId, job.ownerId, reason) };
  }
  return { disposition, queue: markFailure(queue, job.operationId, job.ownerId) };
}

function effectiveDelay(item, pending) {
  if (item.retry) return item.delay;
  const floor = pending
    .filter((other) => other.retry && other.ownerId && other.ownerId === item.ownerId)
    .reduce((max, other) => Math.max(max, other.delay), 0);
  return Math.max(item.delay, floor);
}

function choosePump(pending) {
  if (!pending.length) return { start: null, pending: [] };
  const ranked = pending.map((item, index) => ({ item, index, delay: effectiveDelay(item, pending) }));
  ranked.sort((left, right) => left.delay - right.delay || left.index - right.index);
  const next = ranked[0];
  const rest = [];
  for (const entry of ranked.slice(1)) {
    const delay = entry.delay - next.delay;
    if (delay === 0 && entry.item.ownerId === next.item.ownerId) continue;
    rest.push({ ...entry.item, delay });
  }
  return { start: { ...next.item, delay: next.delay }, pending: rest };
}

function requestPump(gate, request) {
  const pending = gate.pending.concat(request);
  if (gate.pumping) return { pumping: true, pending, start: null };
  const chosen = choosePump(pending);
  return { pumping: false, pending: chosen.pending, start: chosen.start };
}

function finishPump(gate) {
  const chosen = choosePump(gate.pending);
  return { pumping: false, pending: chosen.pending, start: chosen.start };
}

function releaseOwnerListeners(keys, ownerId) {
  return keys.filter((key) => !String(key).startsWith(`${ownerId}:`));
}

function migrateStore(parsed) {
  if (!parsed) return {};
  if (Array.isArray(parsed)) {
    const store = {};
    const legacy = [];
    for (const job of parsed) {
      if (!job || typeof job !== "object" || !job.operationId || !job.matchId) continue;
      if (job.ownerId) {
        store[job.ownerId] = enqueueResult(store[job.ownerId] || [], job);
      } else {
        legacy.push({
          ...job,
          ownerId: null,
          status: job.status === "rejected" ? "rejected" : "pending",
          notice: LEGACY_NOTICE,
          failures: job.failures || 0,
          sceneClosed: Boolean(job.sceneClosed),
          rejectedReason: job.rejectedReason || null,
          result: job.result || null,
          observedOpponent: job.observedOpponent || null,
        });
      }
    }
    if (legacy.length) store.__legacy = legacy;
    return store;
  }
  if (typeof parsed !== "object") return {};
  const store = {};
  for (const [ownerId, queue] of Object.entries(parsed)) {
    if (!Array.isArray(queue)) continue;
    store[ownerId] = [];
    for (const job of queue) {
      if (!job || !job.operationId || !job.matchId) continue;
      if (ownerId === "__legacy" || !job.ownerId) {
        store[ownerId].push(job);
      } else {
        store[ownerId] = enqueueResult(store[ownerId], { ...job, ownerId: job.ownerId || ownerId });
      }
    }
  }
  return store;
}

function mergeStores(memory, stored) {
  const owners = new Set([...Object.keys(memory || {}), ...Object.keys(stored || {})]);
  const out = {};
  for (const owner of owners) {
    const byId = new Map();
    for (const job of stored[owner] || []) byId.set(job.operationId, job);
    for (const job of memory[owner] || []) {
      const previous = byId.get(job.operationId);
      if (!previous || job.status === "rejected" || (job.failures || 0) >= (previous.failures || 0)) {
        byId.set(job.operationId, job);
      }
    }
    out[owner] = [...byId.values()];
  }
  return out;
}

module.exports = {
  LEGACY_NOTICE,
  applyAttempt,
  attemptDisposition,
  enqueueResult,
  finishPump,
  markConfirmed,
  markFailure,
  markRejected,
  markSceneClosed,
  mergeStores,
  migrateStore,
  pendingNotice,
  releaseOwnerListeners,
  requestPump,
  retryDelay,
  selectForSend,
  statusNotice,
};
