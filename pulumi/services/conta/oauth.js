const { createHash, randomBytes } = require("crypto");

function randomToken() {
  return randomBytes(32).toString("base64url");
}

function pkceChallenge(verifier) {
  return createHash("sha256").update(verifier).digest("base64url");
}

function safeReturn(value, allowedOrigins, fallback) {
  const allowed = new Set(allowedOrigins);
  if (!value) return fallback;
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) return fallback;
  let url;
  try {
    url = new URL(value);
  } catch {
    return fallback;
  }
  if (url.username || url.password) return fallback;
  if (url.protocol !== "https:" && url.protocol !== "http:") return fallback;
  if (!allowed.has(url.origin)) return fallback;
  return `${url.origin}${url.pathname}${url.search}`;
}

function assessLogin(record, cookie, state, now) {
  if (!state || !cookie || cookie !== state) return "mismatch";
  if (!record) return "missing";
  if (record.used) return "used";
  if (!record.expiresAt || Date.parse(record.expiresAt) <= now) return "expired";
  if (!record.verifier || !record.returnTo) return "invalid";
  return "ok";
}

function withTicket(returnTo, ticket) {
  const url = new URL(returnTo);
  url.searchParams.set("ticket", ticket);
  return url.toString();
}

module.exports = { randomToken, pkceChallenge, safeReturn, assessLogin, withTicket };
