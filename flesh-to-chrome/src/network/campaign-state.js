const stages = ["esgoto", "industrial", "meio-urbano", "corporativo", "topo"];
const implantOrder = ["pernas", "bracos", "olhos", "propulsores"];
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

function toApiState(save) {
  const progress = save;
  const credits = creditsFor(save, stages.length - 1);
  if (save.endingReached === "chrome") {
    return {
      phase: "ending",
      stageId: "topo",
      checkpointId: null,
      resumePoint: { kind: "start" },
      credits: creditsFor(save, stages.indexOf("topo")),
      implants: [...implantOrder],
      bodyState: "chrome",
      gateChoice: "chrome",
      descent: inactiveDescent(),
      ending: "chrome",
      endings: ["chrome"],
      preGateSnapshot: null,
      progress,
    };
  }
  if (save.endingReached === "flesh") {
    return {
      phase: "ending",
      stageId: "esgoto",
      checkpointId: null,
      resumePoint: { kind: "start" },
      credits,
      implants: [],
      bodyState: "bioprinted",
      gateChoice: "descida",
      descent: {
        step: null,
        chainStatus: "complete",
        memories: ["quem-alex-era", "rua-voz", "amigos", "familia"],
        pendingMemory: null,
        removals: ["propulsores", "olhos", "bracos", "pernas"],
        retryUsedByStage: {},
      },
      ending: "flesh",
      endings: ["flesh"],
      preGateSnapshot: null,
      progress,
    };
  }
  if (save.endingReached === "hollow") {
    return {
      phase: "ending",
      stageId: "topo",
      checkpointId: null,
      resumePoint: { kind: "start" },
      credits: creditsFor(save, stages.indexOf("topo")),
      implants: [...implantOrder],
      bodyState: "implanted",
      gateChoice: "descida",
      descent: {
        step: null,
        chainStatus: "broken",
        memories: [],
        pendingMemory: null,
        removals: [],
        retryUsedByStage: {},
      },
      ending: "hollow",
      endings: ["hollow"],
      preGateSnapshot: null,
      progress,
    };
  }
  const stageId = stageFor(save);
  const count = stages.indexOf(stageId);
  return {
    phase: "ascent",
    stageId,
    checkpointId: null,
    resumePoint: { kind: "start" },
    credits: creditsFor(save, count),
    implants: implantOrder.slice(0, count),
    bodyState: count === 0 ? "original-human" : "implanted",
    gateChoice: null,
    descent: inactiveDescent(),
    ending: null,
    endings: [],
    preGateSnapshot: null,
    progress,
  };
}

function fromApiState(state) {
  if (state?.progress && state.progress.version === 1 && state.progress.checkpoint) return state.progress;
  const phaseByStage = {
    esgoto: "fase1",
    industrial: "fase2-intro",
    "meio-urbano": "fase3",
    corporativo: "fase4",
    topo: "fase5",
  };
  return {
    version: 1,
    currentPhaseId: phaseByStage[state?.stageId] || "fase1",
    checkpoint: {
      x: 0,
      y: 0,
      consolidatedCreditIds: [...(state?.credits?.consolidatedIds || [])],
    },
    wallet: state?.credits?.total || 0,
    abilities: {
      legs: (state?.implants || []).includes("pernas"),
      arms: (state?.implants || []).includes("bracos"),
      eyes: (state?.implants || []).includes("olhos"),
      thrusters: (state?.implants || []).includes("propulsores"),
    },
    descentState: { active: false, brokenChain: false, recoveredFragmentIds: [] },
    preGateSave: null,
    endingReached: state?.ending || null,
  };
}

function sameProgress(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

module.exports = { toApiState, fromApiState, sameProgress };
