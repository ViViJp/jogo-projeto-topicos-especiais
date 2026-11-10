const crypto = require("crypto");

const stages = ["esgoto", "industrial", "meio-urbano", "corporativo", "topo"];
const implants = ["pernas", "bracos", "olhos", "propulsores"];
const memories = ["quem-alex-era", "rua-voz", "amigos", "familia"];
const removals = ["propulsores", "olhos", "bracos", "pernas"];
const ascentImplants = {
  esgoto: 0,
  industrial: 1,
  "meio-urbano": 2,
  corporativo: 3,
  topo: 4,
};

function prefix(list, catalog, count) {
  return Array.isArray(list) && list.length === count && list.every((item, index) => item === catalog[index]);
}

function validateCredits(credits) {
  if (!credits || !Array.isArray(credits.consolidatedIds)) return "créditos ausentes";
  if (!Number.isInteger(credits.total) || credits.total < 0) return "total de créditos inválido";
  const ids = credits.consolidatedIds;
  if (ids.some((id) => typeof id !== "string" || !id)) return "identificador de crédito inválido";
  if (new Set(ids).size !== ids.length) return "crédito consolidado repetido";
  if (ids.length === 0 && credits.total !== 0) return "total incoerente com os créditos";
  if (ids.length > 0 && credits.total < ids.length) return "total incoerente com os créditos";
  return "";
}

function validateDescent(state, expectedChain) {
  const descent = state.descent;
  if (!descent || typeof descent !== "object") return "descida ausente";
  if (!prefix(descent.removals, removals, descent.removals?.length || 0)) return "ordem de retirada inválida";
  if (!prefix(descent.memories, memories, descent.removals.length)) return "memórias fora da ordem das retiradas";
  if (descent.memories.length !== descent.removals.length) return "memória e retirada divergem";
  const pending = descent.pendingMemory;
  if (pending !== null && (!memories.includes(pending) || descent.memories.includes(pending))) {
    return "memória pendente inválida";
  }
  if ((expectedChain === "broken" || expectedChain === "complete") && pending !== null) {
    return "memória pendente depois do fim da cadeia";
  }
  if (descent.chainStatus !== expectedChain) return "estado da cadeia inválido";
  if (expectedChain === "inactive") {
    if (descent.removals.length || descent.memories.length || pending !== null || descent.step !== null) {
      return "descida durante a subida";
    }
    return "";
  }
  const remaining = implants.filter((implant) => !descent.removals.includes(implant));
  if (!sameList(state.implants, remaining)) return "implantes restantes incoerentes com as retiradas";
  return "";
}

function sameList(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every((item, index) => item === right[index]);
}

function validateState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return "state ausente";
  for (const key of ["phase", "stageId", "credits", "implants", "bodyState", "descent", "gateChoice", "ending"]) {
    if (state[key] === undefined) return `state.${key} ausente`;
  }
  if (!["ascent", "descent", "epilogue", "ending"].includes(state.phase)) return "fase inválida";
  if (!stages.includes(state.stageId)) return "setor inválido";
  if (state.checkpointId !== null && (typeof state.checkpointId !== "string" || !state.checkpointId)) {
    return "checkpoint inválido";
  }
  const credits = validateCredits(state.credits);
  if (credits) return credits;

  if (state.phase === "ascent") {
    const count = ascentImplants[state.stageId];
    if (!prefix(state.implants, implants, count)) return "ordem de implantes inválida";
    if (state.gateChoice !== null || state.ending !== null) return "ascensão com final já escolhido";
    if (state.bodyState !== (count === 0 ? "original-human" : "implanted")) return "corpo incoerente com os implantes";
    return validateDescent(state, "inactive");
  }

  if (state.phase === "descent") {
    if (state.gateChoice !== "descida" || state.ending !== null) return "descida sem a recusa do Portão";
    const chain = state.descent?.chainStatus;
    if (!["active", "broken", "complete"].includes(chain)) return "estado da cadeia inválido";
    const problem = validateDescent(state, chain);
    if (problem) return problem;
    const body = state.implants.length === 0 ? "bioprinted" : "implanted";
    if (state.bodyState !== body) return "corpo incoerente com a descida";
    return "";
  }

  if (state.phase === "epilogue") {
    if (state.stageId !== "esgoto" || state.descent?.pendingMemory !== null) return "epílogo inválido";
    return validateDescent(state, state.descent.chainStatus);
  }

  if (state.ending === "chrome") {
    if (state.gateChoice !== "chrome" || state.bodyState !== "chrome" || !sameList(state.implants, implants)) {
      return "final Chrome incoerente";
    }
    return "";
  }
  if (state.ending === "flesh") {
    if (state.bodyState !== "bioprinted" || state.implants.length !== 0 || state.descent?.memories?.length !== 4) {
      return "final Flesh incoerente";
    }
    return "";
  }
  if (state.ending === "hollow") {
    if (state.descent?.chainStatus !== "broken") return "final Hollow sem cadeia quebrada";
    return validateDescent(state, "broken");
  }
  return "final inválido";
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stable(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function fingerprint(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(payload))).digest("hex");
}

module.exports = { validateState, fingerprint, implants, memories };
