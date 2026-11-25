const assert = require("assert");
const { buildRaceResult, normalizeParticipant, submissionsAgree } = require("./results");

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
  guest: { rawTimeMs: 20_000, credits: 0, dnf: false },
}, ["host", "guest"]).error, "resultado de participante inválido");

assert.equal(normalizeParticipant({ rawTimeMs: 1, credits: 20, dnf: false }), null,
  "tempo artificialmente baixo deve ser rejeitado");
const submissions = {
  host: {
    result: { rawTimeMs: 50_000, credits: 4, dnf: false },
    observedOpponent: { rawTimeMs: 49_000, credits: 1, dnf: false },
  },
  guest: {
    result: { rawTimeMs: 49_000, credits: 1, dnf: false },
    observedOpponent: { rawTimeMs: 50_000, credits: 4, dnf: false },
  },
};
assert.equal(submissionsAgree(submissions, ["host", "guest"]), true);
assert.equal(submissionsAgree({
  ...submissions,
  guest: { ...submissions.guest, observedOpponent: { rawTimeMs: 16_000, credits: 20, dnf: false } },
}, ["host", "guest"]), false, "resultados divergentes não podem confirmar vencedor");
assert.equal(submissionsAgree({ host: submissions.host }, ["host", "guest"]), false,
  "um jogador não pode definir unilateralmente a classificação");

console.log("match results: confirmação independente, divergência, DNF e limites OK");
