const stages = ["esgoto", "industrial", "meio-urbano", "corporativo", "topo"];
const implantOrder = ["pernas", "bracos", "olhos", "propulsores"];
const removalOrder = ["propulsores", "olhos", "bracos", "pernas"];
const memoryOrder = ["quem-alex-era", "rua-voz", "amigos", "familia"];
const creditLimits = {
  "f1-risk": 15,
  "f1-safe": 1,
  "f2-risk": 12,
  "f3-risk": 18,
  "f4-normal": 4,
  "f4-risk": 16,
  "f5-normal": 6,
  "f5-risk": 24,
};

function knownCredit(id) {
  const match = /^(f[1-5])-(risk|safe|normal)-(\d{2})$/.exec(id);
  if (!match) return false;
  const count = creditLimits[`${match[1]}-${match[2]}`] || 0;
  const number = Number(match[3]);
  return number >= 1 && number <= count;
}

function creditStageIndex(id) {
  return Number(id.slice(1, 2)) - 1;
}

function inactiveDescent() {
  return {
    step: null,
    chainStatus: "inactive",
    memories: [],
    pendingMemory: null,
    removals: [],
    retryUsedByStage: {},
  };
}

function prefixFrom(value, catalog) {
  if (!Array.isArray(value)) return [];
  let length = 0;
  while (length < value.length && value[length] === catalog[length]) length += 1;
  return catalog.slice(0, length);
}

function creditsFor(save, reached) {
  const ids = [];
  for (const id of save.checkpoint?.consolidatedCreditIds || []) {
    if (!knownCredit(id) || creditStageIndex(id) > reached) continue;
    if (!ids.includes(id)) ids.push(id);
  }
  return { total: ids.length * 10, consolidatedIds: ids };
}

function stageFor(save) {
  const byPhase = {
    fase1: "esgoto",
    "fase2-intro": "industrial",
    fase2: "industrial",
    fase3: "meio-urbano",
    fase4: "corporativo",
    fase5: "topo",
  };
  return byPhase[save.currentPhaseId] || "esgoto";
}

function phaseForStage(stageId) {
  return {
    esgoto: "fase1",
    industrial: "fase2-intro",
    "meio-urbano": "fase3",
    corporativo: "fase4",
    topo: "fase5",
  }[stageId] || "fase1";
}

function checkpointFor(save) {
  const x = Number(save.checkpoint?.x || 0);
  const y = Number(save.checkpoint?.y || 0);
  if (x === 0 && y === 0) return { checkpointId: null, resumePoint: { kind: "start" } };
  return {
    checkpointId: `${save.currentPhaseId}:${x}:${y}`,
    resumePoint: { kind: "checkpoint", x, y },
  };
}

function activeDescent(save) {
  const source = save.descentState || {};
  const removals = prefixFrom(source.removals, removalOrder);
  const memories = prefixFrom(source.memories, memoryOrder).slice(0, removals.length);
  const completePairs = Math.min(removals.length, memories.length);
  const stableRemovals = removals.slice(0, completePairs);
  const stableMemories = memories.slice(0, completePairs);
  let chainStatus = source.chainStatus;
  if (!["active", "broken", "complete"].includes(chainStatus)) {
    chainStatus = source.brokenChain ? "broken" : stableRemovals.length === 4 ? "complete" : "active";
  }
  if (chainStatus === "complete" && stableRemovals.length !== 4) chainStatus = "active";
  let pendingMemory = typeof source.pendingMemory === "string" ? source.pendingMemory : null;
  if (pendingMemory !== memoryOrder[stableMemories.length] || chainStatus !== "active") pendingMemory = null;
  return {
    step: typeof source.step === "string" ? source.step : null,
    chainStatus,
    memories: stableMemories,
    pendingMemory,
    removals: stableRemovals,
    retryUsedByStage: source.retryUsedByStage && typeof source.retryUsedByStage === "object"
      ? { ...source.retryUsedByStage }
      : {},
  };
}

function baseState(save, includeSnapshot) {
  const stageId = stageFor(save);
  const checkpoint = checkpointFor(save);
  const preGateSnapshot = includeSnapshot && save.preGateSave
    ? toApiState({ ...save.preGateSave, preGateSave: null }, false)
    : null;
  return {
    stageId,
    ...checkpoint,
    credits: creditsFor(save, save.descentState?.active ? stages.length - 1 : stages.indexOf(stageId)),
    endings: save.endingReached ? [save.endingReached] : [],
    preGateSnapshot,
  };
}

function toApiState(save, includeSnapshot = true) {
  const base = baseState(save, includeSnapshot);
  if (save.endingReached === "chrome") {
    return {
      ...base,
      phase: "ending",
      stageId: "topo",
      implants: [...implantOrder],
      bodyState: "chrome",
      gateChoice: "chrome",
      descent: inactiveDescent(),
      ending: "chrome",
    };
  }
  if (save.endingReached === "flesh") {
    return {
      ...base,
      phase: "ending",
      stageId: "esgoto",
      implants: [],
      bodyState: "bioprinted",
      gateChoice: "descida",
      descent: {
        step: null,
        chainStatus: "complete",
        memories: [...memoryOrder],
        pendingMemory: null,
        removals: [...removalOrder],
        retryUsedByStage: { ...(save.descentState?.retryUsedByStage || {}) },
      },
      ending: "flesh",
    };
  }
  if (save.endingReached === "hollow") {
    const descent = activeDescent(save);
    descent.chainStatus = "broken";
    descent.pendingMemory = null;
    return {
      ...base,
      phase: "ending",
      implants: implantOrder.filter((implant) => !descent.removals.includes(implant)),
      bodyState: "implanted",
      gateChoice: "descida",
      descent,
      ending: "hollow",
    };
  }
  if (save.descentState?.active) {
    const descent = activeDescent(save);
    const implants = implantOrder.filter((implant) => !descent.removals.includes(implant));
    return {
      ...base,
      phase: "descent",
      implants,
      bodyState: implants.length === 0 ? "bioprinted" : "implanted",
      gateChoice: "descida",
      descent,
      ending: null,
    };
  }
  const count = stages.indexOf(base.stageId);
  return {
    ...base,
    phase: "ascent",
    implants: implantOrder.slice(0, count),
    bodyState: count === 0 ? "original-human" : "implanted",
    gateChoice: null,
    descent: inactiveDescent(),
    ending: null,
  };
}

function fromApiState(state, includeSnapshot = true) {
  const implants = Array.isArray(state?.implants) ? state.implants : [];
  const point = state?.resumePoint;
  const checkpoint = point?.kind === "checkpoint"
    ? { x: Number(point.x) || 0, y: Number(point.y) || 0 }
    : { x: 0, y: 0 };
  const descent = state?.descent || {};
  const phaseIsDescent = state?.phase === "descent" || state?.phase === "epilogue";
  const preGateSave = includeSnapshot && state?.preGateSnapshot
    ? fromApiState({ ...state.preGateSnapshot, preGateSnapshot: null }, false)
    : null;
  return {
    version: 1,
    currentPhaseId: phaseForStage(state?.stageId),
    checkpoint: {
      ...checkpoint,
      consolidatedCreditIds: [...(state?.credits?.consolidatedIds || [])],
    },
    wallet: Number(state?.credits?.total) || 0,
    abilities: {
      legs: implants.includes("pernas"),
      arms: implants.includes("bracos"),
      eyes: implants.includes("olhos"),
      thrusters: implants.includes("propulsores"),
    },
    descentState: {
      active: phaseIsDescent,
      step: typeof descent.step === "string" ? descent.step : null,
      chainStatus: ["inactive", "active", "broken", "complete"].includes(descent.chainStatus)
        ? descent.chainStatus
        : "inactive",
      memories: prefixFrom(descent.memories, memoryOrder),
      pendingMemory: null,
      removals: prefixFrom(descent.removals, removalOrder),
      retryUsedByStage: descent.retryUsedByStage && typeof descent.retryUsedByStage === "object"
        ? { ...descent.retryUsedByStage }
        : {},
    },
    preGateSave,
    endingReached: ["chrome", "flesh", "hollow"].includes(state?.ending) ? state.ending : null,
  };
}

function sameProgress(left, right) {
  return JSON.stringify(toApiState(left)) === JSON.stringify(toApiState(right));
}

module.exports = { toApiState, fromApiState, sameProgress };
