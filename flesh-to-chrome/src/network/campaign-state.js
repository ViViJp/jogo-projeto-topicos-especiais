const stages = ["esgoto", "industrial", "meio-urbano", "corporativo", "topo"];
const implantOrder = ["pernas", "bracos", "olhos", "propulsores"];
const removalOrder = ["propulsores", "olhos", "bracos", "pernas"];
const memoryOrder = ["quem-alex-era", "rua-voz", "amigos", "familia"];
const fragmentOrder = [
  "glitch-topo-identidade",
  "glitch-corporativo-voz",
  "glitch-urbano-amigos",
  "glitch-industrial-familia",
];
const descentPhaseOrder = ["fase5", "fase4", "fase3", "fase2-intro"];
const abilityRemovalOrder = ["thrusters", "eyes", "arms", "legs"];
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
  const legacyRemovals = prefixFrom(source.removals, removalOrder);
  const legacyMemories = prefixFrom(source.memories, memoryOrder).slice(0, legacyRemovals.length);
  const legacyPairs = Math.min(legacyRemovals.length, legacyMemories.length);
  const completedCount = Number.isInteger(source.currentStep)
    ? Math.max(0, Math.min(removalOrder.length, source.currentStep))
    : legacyPairs;
  const stableRemovals = removalOrder.slice(0, completedCount);
  const stableMemories = memoryOrder.slice(0, completedCount);
  let chainStatus = source.brokenChain || source.chainStatus === "broken"
    ? "broken"
    : completedCount === removalOrder.length || source.chainStatus === "complete"
      ? "complete"
      : "active";
  if (chainStatus === "complete" && completedCount !== removalOrder.length) chainStatus = "active";
  const recovered = Array.isArray(source.recoveredFragmentIds) ? source.recoveredFragmentIds : [];
  const nextMemoryRecovered = recovered.includes(fragmentOrder[completedCount])
    || source.pendingRemoval === abilityRemovalOrder[completedCount];
  let pendingMemory = nextMemoryRecovered ? memoryOrder[completedCount] || null : null;
  if (typeof source.pendingMemory === "string") pendingMemory = source.pendingMemory;
  if (pendingMemory !== memoryOrder[completedCount] || chainStatus !== "active") pendingMemory = null;
  const retryUsedByStage = {};
  if (source.retryUsedByStage && typeof source.retryUsedByStage === "object") {
    Object.assign(retryUsedByStage, source.retryUsedByStage);
  }
  for (const phaseId of source.retryUsedPhaseIds || []) {
    retryUsedByStage[stageFor({ currentPhaseId: phaseId })] = true;
  }
  return {
    step: typeof source.step === "string"
      ? source.step
      : completedCount < descentPhaseOrder.length
        ? `D${completedCount + 1}`
        : null,
    chainStatus,
    memories: stableMemories,
    pendingMemory,
    removals: stableRemovals,
    retryUsedByStage,
  };
}

function baseState(save, includeSnapshot) {
  const stageId = stageFor(save);
  const checkpoint = checkpointFor(save);
  const descent = save.descentState || {};
  const descentStarted = Boolean(
    descent.active ||
    descent.brokenChain ||
    descent.epiloguePending ||
    descent.currentStep > 0 ||
    descent.recoveredFragmentIds?.length
  );
  const preGateSnapshot = includeSnapshot && save.preGateSave
    ? toApiState({ ...save.preGateSave, preGateSave: null }, false)
    : null;
  return {
    stageId,
    ...checkpoint,
    credits: creditsFor(save, descentStarted ? stages.length - 1 : stages.indexOf(stageId)),
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
        retryUsedByStage: activeDescent(save).retryUsedByStage,
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
  if (save.descentState?.brokenChain || save.descentState?.currentStep >= removalOrder.length) {
    const descent = activeDescent(save);
    const implants = implantOrder.filter((implant) => !descent.removals.includes(implant));
    return {
      ...base,
      phase: "epilogue",
      stageId: descent.chainStatus === "complete" ? "esgoto" : base.stageId,
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
  const chainStatus = ["inactive", "active", "broken", "complete"].includes(descent.chainStatus)
    ? descent.chainStatus
    : "inactive";
  const completedCount = Math.min(
    removalOrder.length,
    prefixFrom(descent.removals, removalOrder).length,
  );
  const pendingIndex = memoryOrder.indexOf(descent.pendingMemory);
  const recoveredFragmentIds = fragmentOrder.slice(0, completedCount);
  if (pendingIndex === completedCount && fragmentOrder[pendingIndex]) {
    recoveredFragmentIds.push(fragmentOrder[pendingIndex]);
  }
  const retryUsedPhaseIds = Object.entries(descent.retryUsedByStage || {})
    .filter(([, used]) => used)
    .map(([stageId]) => phaseForStage(stageId))
    .filter((phaseId) => descentPhaseOrder.includes(phaseId));
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
      active: state?.phase === "descent" && chainStatus === "active",
      brokenChain: chainStatus === "broken",
      epiloguePending: state?.phase === "epilogue" && chainStatus === "complete" && state?.ending == null,
      currentStep: completedCount,
      recoveredFragmentIds,
      retryUsedPhaseIds,
      pendingRemoval: pendingIndex === completedCount ? abilityRemovalOrder[pendingIndex] || null : null,
    },
    preGateSave,
    endingReached: ["chrome", "flesh", "hollow"].includes(state?.ending) ? state.ending : null,
  };
}

function sameProgress(left, right) {
  return JSON.stringify(toApiState(left)) === JSON.stringify(toApiState(right));
}

module.exports = { toApiState, fromApiState, sameProgress };
