const assert = require("assert");
const { buildRaceResult } = require("./results");

const completed = buildRaceResult({
  host: { rawTimeMs: 50_000, credits: 4, dnf: false },
  guest: { rawTimeMs: 49_000, credits: 1, dnf: false },
}, ["host", "guest"], "2026-11-25T12:00:00.000Z");
assert.equal(completed.result.winnerUserId, "host", "tempo ajustado deve decidir a classificação");
assert.equal(completed.result.standings[0].adjustedTimeMs, 48_000);

const dnf = buildRaceResult({
  host: { rawTimeMs: 60_000, credits: 0, dnf: false },
  guest: { rawTimeMs: null, credits: 2, dnf: true },
}, ["host", "guest"]);
assert.equal(dnf.result.winnerUserId, "host");
assert.equal(dnf.result.standings[1].place, 2);

assert.equal(buildRaceResult({ host: { rawTimeMs: 1, credits: 0, dnf: false } }, ["host", "guest"]).error,
  "participantes divergentes");
assert.equal(buildRaceResult({
  host: { rawTimeMs: -1, credits: 0, dnf: false },
  guest: { rawTimeMs: 1, credits: 0, dnf: false },
}, ["host", "guest"]).error, "resultado de participante inválido");

console.log("match results: classificação, DNF e validação OK");
