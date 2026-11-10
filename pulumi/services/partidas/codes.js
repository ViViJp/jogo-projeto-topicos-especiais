const crypto = require("crypto");

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode() {
  const bytes = crypto.randomBytes(10);
  let raw = "";
  for (let index = 0; index < 10; index += 1) raw += alphabet[bytes[index] % alphabet.length];
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

function normalizeCode(input) {
  const raw = String(input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (raw.length !== 10) return "";
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

function hashCode(code) {
  const raw = normalizeCode(code).replace("-", "");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

module.exports = { generateCode, normalizeCode, hashCode };
