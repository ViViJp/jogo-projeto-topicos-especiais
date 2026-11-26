const assert = require("assert");
const { issueDecision, consumeDecision } = require("./ticket");

const match = { id: "match-1", state: "running", hostUserId: "host", guestUserId: "guest" };
const now = Date.parse("2026-11-25T12:00:00.000Z");

assert.equal(issueDecision(match, "intruder", now).error, "not-participant");
assert.equal(issueDecision({ ...match, state: "finished" }, "host", now).error, "closed");
assert.equal(typeof issueDecision(match, "host", now).expiresAt, "string");

assert.equal(consumeDecision(null, now).error, "unauthenticated");
assert.equal(consumeDecision({ userId: "host", matchId: "match-1", expiresAt: "2026-11-25T11:59:00.000Z" }, now).error, "expired");
assert.equal(consumeDecision({ userId: "host", matchId: "match-1", used: true, expiresAt: "2026-11-25T12:02:00.000Z" }, now).error, "used");
assert.deepEqual(
  consumeDecision({ userId: "host", matchId: "match-1", expiresAt: "2026-11-25T12:02:00.000Z" }, now),
  { userId: "host", matchId: "match-1" },
);

console.log("connection ticket: ausente, expirado, usado e participante OK");
