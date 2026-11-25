function authorizeIdentity(connection, envelope) {
  if (!connection?.userId || !connection?.matchId || !envelope) return false;
  return envelope.roomId === connection.matchId && envelope.from === connection.userId;
}

function claimSlot(occupied) {
  if (!occupied.includes(0)) return 0;
  if (!occupied.includes(1)) return 1;
  return null;
}

function recordExpired(record, nowSeconds) {
  if (!record) return true;
  const expiresAt = Number(record.expiresAt);
  if (!Number.isFinite(expiresAt)) return true;
  return expiresAt <= nowSeconds;
}

function replacementPlan(slots, peer, userId, nowSeconds) {
  const list = [slots?.[0] || null, slots?.[1] || null];
  const ownIndex = list.findIndex((slot) => slot?.peerId === userId);
  let slot = ownIndex;
  if (slot < 0) {
    slot = list.findIndex((item) => recordExpired(item, nowSeconds));
  }
  if (slot < 0) return null;
  const occupying = list[slot];
  const ownPeer = peer?.peerId === userId ? peer : null;
  const displaced = occupying && occupying.peerId !== userId ? occupying : null;
  const oldSlot = ownPeer && Number.isInteger(ownPeer.slot) ? ownPeer.slot : null;
  return {
    slot,
    previousConnectionId: ownPeer?.connectionId || null,
    retireSlot: oldSlot !== null && oldSlot !== slot && list[oldSlot]?.peerId === userId ? oldSlot : null,
    displacedPeerId: displaced?.peerId || null,
    displacedConnectionId: displaced?.connectionId || null,
  };
}

function disconnectMayRelease(record, connectionId) {
  return Boolean(record?.connectionId) && record.connectionId === connectionId;
}

module.exports = { authorizeIdentity, claimSlot, disconnectMayRelease, recordExpired, replacementPlan };
