const MAX_RACE_DURATION_MS = 10 * 60 * 1000;
const MAX_CREDITS = 20;
const MIN_RACE_DURATION_MS = 15 * 1000;
const CONFIRMATION_WAIT_MS = 60 * 1000;

function adjustedTime(entry) {
  return Math.max(0, entry.rawTimeMs - Math.min(entry.credits * 500, 10_000));
}

function normalizeParticipant(value) {
  if (!value || typeof value !== "object" || typeof value.dnf !== "boolean") return null;
  const credits = Number(value.credits);
  if (!Number.isInteger(credits) || credits < 0 || credits > MAX_CREDITS) return null;
  if (value.dnf) return { rawTimeMs: null, credits, dnf: true };
  const rawTimeMs = Number(value.rawTimeMs);
  if (!Number.isInteger(rawTimeMs) || rawTimeMs < MIN_RACE_DURATION_MS || rawTimeMs > MAX_RACE_DURATION_MS) return null;
  return { rawTimeMs, credits, dnf: false };
}

function sameParticipant(left, right) {
  if (!left || !right || left.dnf !== right.dnf || left.credits !== right.credits) return false;
  return left.dnf || left.rawTimeMs === right.rawTimeMs;
}

function submissionsAgree(submissions, participantIds) {
  if (!participantIds.every((id) => submissions[id])) return false;
  return participantIds.every((userId) => {
    const opponentId = participantIds.find((id) => id !== userId);
    return sameParticipant(submissions[userId].observedOpponent, submissions[opponentId].result);
  });
}

function buildRaceResult(submission, participantIds, finishedAt = new Date().toISOString()) {
  if (!submission || typeof submission !== "object" || Array.isArray(submission)) return { error: "resultado ausente" };
  const submittedIds = Object.keys(submission).sort();
  const expectedIds = [...participantIds].sort();
  if (submittedIds.length !== expectedIds.length || submittedIds.some((id, index) => id !== expectedIds[index])) {
    return { error: "participantes divergentes" };
  }
  const standings = [];
  for (const userId of participantIds) {
    const normalized = normalizeParticipant(submission[userId]);
    if (!normalized) return { error: "resultado de participante inválido" };
    standings.push({
      userId,
      ...normalized,
      adjustedTimeMs: normalized.dnf ? null : adjustedTime(normalized),
      place: null,
    });
  }
  standings.sort((left, right) => {
    if (left.dnf !== right.dnf) return left.dnf ? 1 : -1;
    if (left.dnf && right.dnf) return left.userId.localeCompare(right.userId);
    return left.adjustedTimeMs - right.adjustedTimeMs
      || right.credits - left.credits
      || left.rawTimeMs - right.rawTimeMs
      || left.userId.localeCompare(right.userId);
  });
  const bothDnf = standings.every((entry) => entry.dnf);
  const tied = !bothDnf && !standings[0].dnf && !standings[1].dnf
    && standings[0].adjustedTimeMs === standings[1].adjustedTimeMs
    && standings[0].credits === standings[1].credits
    && standings[0].rawTimeMs === standings[1].rawTimeMs;
  standings.forEach((entry, index) => {
    entry.place = bothDnf ? null : tied ? 1 : index + 1;
  });
  return {
    result: {
      winnerUserId: bothDnf || tied ? null : standings[0].userId,
      reason: "completed",
      finishedAt,
      standings,
    },
  };
}

function incompleteConfirmation(submissions, participantIds, nowMs, context = {}) {
  if (!Array.isArray(participantIds) || participantIds.length !== 2) return null;
  const present = participantIds.filter((id) => submissions?.[id]);
  if (present.length !== 1) return null;
  const userId = present[0];
  const submittedAt = Date.parse(submissions[userId].submittedAt || "");
  if (!Number.isFinite(submittedAt)) return null;
  const missingUserId = participantIds.find((id) => id !== userId);
  const own = normalizeParticipant(submissions[userId].result);
  if (!own || !missingUserId) return null;
  if (context.opponentPresent === true) return null;
  const opponentAbsent = context.opponentAbsent === true;
  if (!opponentAbsent && nowMs < submittedAt + CONFIRMATION_WAIT_MS) return null;
  const finishedAt = new Date(nowMs).toISOString();
  const missingStanding = {
    userId: missingUserId, rawTimeMs: null, credits: 0, dnf: true, adjustedTimeMs: null, place: null,
  };
  if (!opponentAbsent || own.dnf) {
    return {
      result: {
        winnerUserId: null,
        reason: "inconclusive",
        finishedAt,
        missingConfirmation: true,
        unconfirmedUserId: missingUserId,
        standings: [
          { userId, ...own, adjustedTimeMs: own.dnf ? null : adjustedTime(own), place: null },
          missingStanding,
        ],
      },
      resultStatus: "expired",
    };
  }
  return {
    result: {
      winnerUserId: userId,
      reason: "abandon",
      finishedAt,
      missingConfirmation: true,
      unconfirmedUserId: missingUserId,
      standings: [
        { userId, ...own, adjustedTimeMs: adjustedTime(own), place: 1 },
        { ...missingStanding, place: 2 },
      ],
    },
    resultStatus: "confirmed",
  };
}

function disconnectOutcome(elapsedMs) {
  return {
    elapsedMs: Number.isFinite(elapsedMs) ? elapsedMs : null,
    reason: "abandon",
    rawTimeMs: null,
    resultStatus: "confirmed",
  };
}

module.exports = {
  CONFIRMATION_WAIT_MS,
  adjustedTime,
  buildRaceResult,
  incompleteConfirmation,
  normalizeParticipant,
  sameParticipant,
  submissionsAgree,
  disconnectOutcome,
};
