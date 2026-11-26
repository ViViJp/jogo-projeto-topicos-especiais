const assert = require("assert");
const { buildRaceResult, disconnectOutcome, incompleteConfirmation, normalizeParticipant, submissionsAgree } = require("./results");

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

const submittedAt = Date.parse("2026-11-25T12:00:00.000Z");
const pending = {
  host: {
    result: { rawTimeMs: 50_000, credits: 4, dnf: false },
    observedOpponent: { rawTimeMs: null, credits: 0, dnf: true },
    submittedAt: new Date(submittedAt).toISOString(),
  },
};
assert.equal(
  incompleteConfirmation(pending, ["host", "guest"], submittedAt + 90_000, { opponentPresent: true }),
  null,
  "adversário conectado não perde por tempo esgotado",
);
const abandoned = incompleteConfirmation(pending, ["host", "guest"], submittedAt + 90_000, { opponentAbsent: true });
assert.equal(abandoned.result.winnerUserId, "host");
assert.equal(abandoned.result.reason, "abandon");
assert.equal(abandoned.result.unconfirmedUserId, "guest");
assert.equal(abandoned.resultStatus, "confirmed");
const loneDnf = {
  host: {
    result: { rawTimeMs: null, credits: 0, dnf: true },
    observedOpponent: { rawTimeMs: null, credits: 0, dnf: true },
    submittedAt: new Date(submittedAt).toISOString(),
  },
};
const dnfAbsent = incompleteConfirmation(loneDnf, ["host", "guest"], submittedAt + 90_000, { opponentAbsent: true });
assert.equal(dnfAbsent.result.winnerUserId, null, "DNF não recebe vitória automática");
assert.equal(dnfAbsent.result.reason, "inconclusive");
assert.equal(dnfAbsent.resultStatus, "expired");
assert.equal(
  incompleteConfirmation(loneDnf, ["host", "guest"], submittedAt + 90_000, { opponentPresent: true }),
  null,
);
const unproven = incompleteConfirmation(pending, ["host", "guest"], submittedAt + 90_000, {});
assert.equal(unproven.result.winnerUserId, null);
assert.equal(unproven.result.reason, "inconclusive");

for (const elapsed of [null, -1_000, 5_000, 15_000]) {
  const disconnected = disconnectOutcome(elapsed);
  assert.equal(disconnected.reason, "abandon");
  assert.equal(disconnected.rawTimeMs, null, "desconexão não inventa tempo de conclusão");
  assert.equal(disconnected.resultStatus, "confirmed");
}
assert.equal(normalizeParticipant({ rawTimeMs: 5_000, credits: 0, dnf: false }), null);
assert.equal(normalizeParticipant({ rawTimeMs: 0, credits: 0, dnf: false }), null);

console.log("match results: confirmação independente, divergência, DNF e limites OK");
