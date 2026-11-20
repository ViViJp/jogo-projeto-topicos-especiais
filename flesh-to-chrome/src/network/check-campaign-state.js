const assert = require("assert");
const { validateState } = require("../../../pulumi/services/campanha/rules");
const { toApiState, fromApiState, sameProgress } = require("./campaign-state");

function save(extra) {
  return {
    version: 1,
    currentPhaseId: "fase1",
    checkpoint: { x: 12, y: 4, consolidatedCreditIds: ["f1-risk-01", "mp-credit-1", "f1-risk-01"] },
    wallet: 30,
    abilities: { legs: false, arms: false, eyes: false, thrusters: false },
    descentState: { active: false, brokenChain: false, recoveredFragmentIds: [] },
    preGateSave: null,
    endingReached: null,
    ...extra,
  };
}

for (const sample of [
  save(),
  save({ currentPhaseId: "fase3", abilities: { legs: true, arms: true, eyes: false, thrusters: false } }),
  save({ endingReached: "chrome" }),
  save({ endingReached: "flesh" }),
  save({ endingReached: "hollow" }),
]) {
  const state = toApiState(sample);
  assert.equal(validateState(state), "", JSON.stringify(state));
  assert.equal(state.credits.consolidatedIds.includes("mp-credit-1"), false);
  assert.equal(fromApiState(state).checkpoint.x, 12);
}

assert.equal(sameProgress(save(), save()), true);
assert.equal(sameProgress(save(), save({ wallet: 1 })), false);
console.log("campaign-state ok");
