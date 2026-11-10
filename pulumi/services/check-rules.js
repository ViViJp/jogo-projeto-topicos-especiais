const assert = require("assert");
const { validateState, validateTransition } = require("./campanha/rules");
const { generateCode, normalizeCode, hashCode } = require("./partidas/codes");

const initial = {
  phase: "ascent",
  stageId: "esgoto",
  checkpointId: null,
  credits: { total: 0, consolidatedIds: [] },
  implants: [],
  bodyState: "original-human",
  gateChoice: null,
  descent: {
    step: null,
    chainStatus: "inactive",
    memories: [],
    pendingMemory: null,
    removals: [],
    retryUsedByStage: {},
  },
  ending: null,
};

assert.equal(validateState(initial), "");
assert.equal(validateState({ ...initial, stageId: "industrial", implants: ["bracos"], bodyState: "implanted" }), "ordem de implantes inválida");
assert.equal(
  validateState({ ...initial, credits: { total: 1, consolidatedIds: ["a", "a"] } }),
  "crédito consolidado repetido"
);
assert.equal(validateState({ ...initial, credits: { total: 0, consolidatedIds: ["a"] } }), "total incoerente com os créditos");

const descent = {
  ...initial,
  phase: "descent",
  stageId: "topo",
  implants: ["pernas", "bracos", "olhos", "propulsores"],
  bodyState: "implanted",
  gateChoice: "descida",
  descent: {
    step: null,
    chainStatus: "active",
    memories: [],
    pendingMemory: "quem-alex-era",
    removals: [],
    retryUsedByStage: {},
  },
};
assert.equal(validateState(descent), "");
descent.descent.pendingMemory = "quem-alex-era";
descent.descent.memories = ["quem-alex-era"];
assert.notEqual(validateState(descent), "");

const flesh = {
  phase: "ending",
  stageId: "esgoto",
  checkpointId: null,
  credits: { total: 0, consolidatedIds: [] },
  implants: [],
  bodyState: "bioprinted",
  gateChoice: "descida",
  descent: {
    step: "D4",
    chainStatus: "complete",
    memories: ["quem-alex-era", "rua-voz", "amigos", "familia"],
    pendingMemory: null,
    removals: ["propulsores", "olhos", "bracos", "pernas"],
    retryUsedByStage: {},
  },
  ending: "flesh",
};
assert.equal(validateState(flesh), "");
assert.notEqual(validateState({ ...flesh, gateChoice: "chrome" }), "");
assert.notEqual(validateState({ ...flesh, descent: { ...flesh.descent, chainStatus: "active" } }), "");
assert.notEqual(validateState({ ...flesh, descent: { ...flesh.descent, removals: [] } }), "");

const epilogue = { ...flesh, phase: "epilogue", ending: null };
assert.equal(validateState(epilogue), "");
assert.notEqual(validateState({ ...epilogue, descent: { ...epilogue.descent, chainStatus: "active" } }), "");
assert.notEqual(validateState({ ...epilogue, descent: { ...epilogue.descent, pendingMemory: "familia" } }), "");

const climbed = {
  ...initial,
  stageId: "industrial",
  implants: ["pernas"],
  bodyState: "implanted",
  checkpointId: "tv-1",
};
assert.equal(validateTransition(initial, climbed), "");
assert.notEqual(validateTransition(climbed, initial), "");
assert.notEqual(
  validateTransition(flesh, { ...flesh, descent: { ...flesh.descent, removals: flesh.descent.removals.slice(0, 3) } }),
  ""
);
assert.notEqual(validateTransition({ ...climbed, checkpointId: "tv-1" }, { ...climbed, checkpointId: null }), "");

const code = generateCode();
assert.match(code, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
assert.equal(normalizeCode(code.toLowerCase()), code);
assert.equal(hashCode(code), hashCode(code.replace("-", "")));
assert.equal(normalizeCode("curto"), "");

console.log("ok");
