const TICKET_TTL_MS = 2 * 60 * 1000;

function issueDecision(match, userId, now) {
  if (!match || !userId) return { error: "unauthenticated" };
  const participants = [match.hostUserId, match.guestUserId].filter(Boolean);
  if (!participants.includes(userId)) return { error: "not-participant" };
  if (match.state === "finished" || match.state === "cancelled") return { error: "closed" };
  return { expiresAt: new Date(now + TICKET_TTL_MS).toISOString() };
}

function consumeDecision(ticket, now) {
  if (!ticket?.userId || !ticket?.matchId) return { error: "unauthenticated" };
  if (ticket.used) return { error: "used" };
  if (Date.parse(ticket.expiresAt) <= now) return { error: "expired" };
  return { userId: ticket.userId, matchId: ticket.matchId };
}

module.exports = { TICKET_TTL_MS, issueDecision, consumeDecision };
