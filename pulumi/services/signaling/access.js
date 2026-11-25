function authorizeIdentity(connection, envelope) {
  if (!connection?.userId || !connection?.matchId || !envelope) return false;
  return envelope.roomId === connection.matchId && envelope.from === connection.userId;
}

function claimSlot(occupied) {
  if (!occupied.includes(0)) return 0;
  if (!occupied.includes(1)) return 1;
  return null;
}

module.exports = { authorizeIdentity, claimSlot };
