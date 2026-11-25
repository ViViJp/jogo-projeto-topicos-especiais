const PRESENCE_LEASE_MS = 45 * 1000;

function participantIds(match) {
  return [match.hostUserId, match.guestUserId].filter(Boolean);
}

function presenceFresh(match, userId, now = Date.now(), leaseMs = PRESENCE_LEASE_MS) {
  const seen = Date.parse(match.presence?.[userId]?.lastSeenAt || "");
  return Number.isFinite(seen) && now - seen <= leaseMs;
}

function allParticipantsStale(match, now = Date.now(), leaseMs = PRESENCE_LEASE_MS) {
  return participantIds(match).every((userId) => !presenceFresh(match, userId, now, leaseMs));
}

module.exports = { PRESENCE_LEASE_MS, participantIds, presenceFresh, allParticipantsStale };
