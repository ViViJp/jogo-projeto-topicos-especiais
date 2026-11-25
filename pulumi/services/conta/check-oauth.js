const assert = require("assert");
const { pkceChallenge, safeReturn, assessLogin, withTicket } = require("./oauth");

const allowed = ["https://jogo.example", "http://localhost:1234"];
const fallback = "https://jogo.example/";

assert.equal(safeReturn("https://evil.example/roubo", allowed, fallback), fallback);
assert.equal(safeReturn("http://jogo.example/ok", allowed, fallback), fallback);
assert.equal(safeReturn("//evil.example", allowed, fallback), fallback);
assert.equal(safeReturn("/menu", allowed, fallback), fallback);
assert.equal(safeReturn("javascript:alert(1)", allowed, fallback), fallback);
assert.equal(
  safeReturn("https://jogo.example/index.html?room=1", allowed, fallback),
  "https://jogo.example/index.html?room=1"
);
assert.equal(safeReturn("http://localhost:1234/", allowed, fallback), "http://localhost:1234/");
assert.equal(safeReturn("https://user:pass@jogo.example/", allowed, fallback), fallback);

const verifier = "abc";
assert.equal(pkceChallenge(verifier), pkceChallenge(verifier));
assert.notEqual(pkceChallenge(verifier), pkceChallenge("outro"));

const now = Date.parse("2026-11-16T12:00:00.000Z");
const record = {
  used: false,
  expiresAt: "2026-11-16T12:05:00.000Z",
  verifier: "v",
  returnTo: "https://jogo.example/",
};
assert.equal(assessLogin(record, "estado", "estado", now), "ok");
assert.equal(assessLogin(record, "", "estado", now), "mismatch");
assert.equal(assessLogin(record, "outro", "estado", now), "mismatch");
assert.equal(assessLogin(null, "estado", "estado", now), "missing");
assert.equal(assessLogin({ ...record, used: true }, "estado", "estado", now), "used");
assert.equal(
  assessLogin({ ...record, expiresAt: "2026-11-16T11:00:00.000Z" }, "estado", "estado", now),
  "expired"
);

assert.equal(
  withTicket("https://jogo.example/index.html?room=1", "t1"),
  "https://jogo.example/index.html?room=1&ticket=t1"
);

console.log("oauth ok");
