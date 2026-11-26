const assert = require("assert");
const { PRESENCE_LEASE_MS, allParticipantsStale, awardDisconnectAllowed, presenceFresh, presenceState } = require("./lease");

const now = Date.parse("2026-11-25T12:00:00.000Z");
const match = {
  hostUserId: "host",
  guestUserId: "guest",
  presence: {
    host: { lastSeenAt: new Date(now - 5_000).toISOString(), connected: true },
    guest: { lastSeenAt: new Date(now - 10_000).toISOString(), connected: true },
  },
};
assert.equal(allParticipantsStale(match, now), false, "partida ativa não pode ser removida");
match.presence.host.lastSeenAt = new Date(now - PRESENCE_LEASE_MS - 1).toISOString();
assert.equal(allParticipantsStale(match, now), false, "um participante ativo preserva a retomada");
match.presence.guest.lastSeenAt = new Date(now - PRESENCE_LEASE_MS - 1).toISOString();
assert.equal(allParticipantsStale(match, now), true, "dois leases expirados liberam os vínculos");
assert.equal(presenceFresh(match, "host", now), false);
assert.equal(presenceState(match, "guest", now), "absent");
assert.equal(presenceState({ presence: {} }, "guest", now), "unknown", "sem sinal não prova abandono");
match.presence.guest.lastSeenAt = new Date(now - 1_000).toISOString();
assert.equal(presenceState(match, "guest", now), "present");
assert.equal(awardDisconnectAllowed(match, "host", now), false, "adversário conectado não perde por pedido do cliente");
match.presence.guest.lastSeenAt = new Date(now - PRESENCE_LEASE_MS - 1).toISOString();
assert.equal(awardDisconnectAllowed(match, "host", now), true, "ausência confirmada depois do prazo libera o abandono");
assert.equal(awardDisconnectAllowed({ hostUserId: "host", guestUserId: "guest", presence: {} }, "host", now), false);

console.log("match lease: presença, retomada e expiração OK");
