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
    descentState: {
      active: false,
      brokenChain: false,
      epiloguePending: false,
      currentStep: 0,
      recoveredFragmentIds: [],
      retryUsedPhaseIds: [],
      pendingRemoval: null,
    },
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
  assert.equal(Object.prototype.hasOwnProperty.call(state, "progress"), false);
  assert.equal(validateState(toApiState(fromApiState(state))), "");
}

const preGate = save({ currentPhaseId: "fase5", abilities: { legs: true, arms: true, eyes: true, thrusters: true } });
const withSnapshot = toApiState(save({ currentPhaseId: "fase5", preGateSave: preGate }));
assert.equal(withSnapshot.preGateSnapshot.phase, "ascent");
assert.equal(validateState(withSnapshot.preGateSnapshot), "");

const descent = save({
  currentPhaseId: "fase4",
  abilities: { legs: true, arms: true, eyes: true, thrusters: false },
  descentState: {
    active: true,
    brokenChain: false,
    epiloguePending: false,
    currentStep: 1,
    recoveredFragmentIds: ["glitch-topo-identidade", "glitch-corporativo-voz"],
    retryUsedPhaseIds: ["fase5"],
    pendingRemoval: "eyes",
  },
});
const descentState = toApiState(descent);
assert.equal(validateState(descentState), "");
const restoredDescent = fromApiState(descentState);
assert.equal(restoredDescent.descentState.currentStep, 1);
assert.deepEqual(restoredDescent.descentState.recoveredFragmentIds,
  ["glitch-topo-identidade"], "a nuvem só restaura memórias consolidadas");
assert.equal(restoredDescent.descentState.pendingRemoval, null);
assert.equal(descentState.descent.pendingMemory, null, "memória pendente não deve ser sincronizada");
assert.deepEqual(restoredDescent.descentState.retryUsedPhaseIds, ["fase5"]);

const tampered = {
  ...toApiState(save()),
  progress: save({
    wallet: 999,
    checkpoint: { x: 999, y: 999, consolidatedCreditIds: ["mp-credit-1"] },
    abilities: { legs: true, arms: true, eyes: true, thrusters: true },
  }),
};
const restoredTampered = fromApiState(tampered);
assert.equal(restoredTampered.wallet, 10);
assert.deepEqual(restoredTampered.checkpoint.consolidatedCreditIds, ["f1-risk-01"]);
assert.equal(restoredTampered.abilities.legs, false);

assert.equal(sameProgress(save(), save()), true);
assert.equal(sameProgress(save(), save({ wallet: 1 })), true);
assert.equal(sameProgress(save(), save({ checkpoint: { x: 13, y: 4, consolidatedCreditIds: ["f1-risk-01"] } })), false);
console.log("campaign-state ok");
