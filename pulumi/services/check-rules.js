const assert = require("assert");
const { validateState } = require("./campanha/rules");
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

const code = generateCode();
assert.match(code, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
assert.equal(normalizeCode(code.toLowerCase()), code);
assert.equal(hashCode(code), hashCode(code.replace("-", "")));
assert.equal(normalizeCode("curto"), "");

console.log("ok");
