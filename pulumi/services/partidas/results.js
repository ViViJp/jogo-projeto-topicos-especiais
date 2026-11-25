const MAX_RACE_DURATION_MS = 10 * 60 * 1000;
const MAX_CREDITS = 20;

function adjustedTime(entry) {
  return Math.max(0, entry.rawTimeMs - Math.min(entry.credits * 500, 10_000));
}

function normalizeParticipant(value) {
  if (!value || typeof value !== "object" || typeof value.dnf !== "boolean") return null;
  const credits = Number(value.credits);
  if (!Number.isInteger(credits) || credits < 0 || credits > MAX_CREDITS) return null;
  if (value.dnf) return { rawTimeMs: null, credits, dnf: true };
  const rawTimeMs = Number(value.rawTimeMs);
  if (!Number.isInteger(rawTimeMs) || rawTimeMs < 0 || rawTimeMs > MAX_RACE_DURATION_MS) return null;
  return { rawTimeMs, credits, dnf: false };
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

module.exports = { adjustedTime, buildRaceResult };
