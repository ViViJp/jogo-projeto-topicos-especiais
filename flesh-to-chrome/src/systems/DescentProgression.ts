import type { AbilityState } from "./AbilityState";

export type DescentPhaseId = "fase5" | "fase4" | "fase3" | "fase2-intro";
export type DescentRoutePhaseId = DescentPhaseId | "fase1";

export interface DescentRoute {
  phaseId: DescentRoutePhaseId;
  title: string;
  startX: number;
  startY: number;
  endX: number;
  targetSeconds: number;
  requiredAbilities: readonly (keyof AbilityState)[];
  /** Barreira exclusiva da descida que torna o ataque obrigatório. */
  attackBarrierX?: number;
  /** Faixa fatal larga demais para o salto simples. */
  doubleJumpHazard?: { x: number; width: number };
  /** Oculta tiles do setor anterior que ainda caberiam atrás do spawn. */
  hidePreviousMapContent?: boolean;
  /** Remove inimigos autorados perto demais do spawn exclusivo da descida. */
  enemySafeStartPx?: number;
  epilogue?: boolean;
}

export interface DescentStep {
  phaseId: DescentPhaseId;
  fragmentId: string;
  implant: keyof AbilityState;
  memoryTitle: string;
  memory: string;
  fragmentAsset: "topo" | "corporativo" | "urbano" | "industrial";
  nextPhaseId: DescentPhaseId | "fase1";
}

/** Ordem narrativa obrigatoria descrita no GDD, secao 18.4. */
export const DESCENT_STEPS: readonly DescentStep[] = [
  {
    phaseId: "fase5",
    fragmentId: "glitch-topo-identidade",
    implant: "thrusters",
    memoryTitle: "QUEM ALEX ERA",
    memory: "Antes do cromo, havia um filho que corria para casa. Alex se lembra de que nunca foi uma obra.",
    fragmentAsset: "topo",
    nextPhaseId: "fase4",
  },
  {
    phaseId: "fase4",
    fragmentId: "glitch-corporativo-voz",
    implant: "eyes",
    memoryTitle: "A VOZ DA RUA",
    memory: "A cidade conhecia sua voz antes que as vitrines a apagassem. Alex se lembra das próprias raízes.",
    fragmentAsset: "corporativo",
    nextPhaseId: "fase3",
  },
  {
    phaseId: "fase3",
    fragmentId: "glitch-urbano-amigos",
    implant: "arms",
    memoryTitle: "OS AMIGOS",
    memory: "Maos humanas o ergueram muito antes dos bracos de metal. Alex se lembra de quem nunca o tratou como peça.",
    fragmentAsset: "urbano",
    nextPhaseId: "fase2-intro",
  },
  {
    phaseId: "fase2-intro",
    fragmentId: "glitch-industrial-familia",
    implant: "legs",
    memoryTitle: "A FAMILIA",
    memory: "Nao era o topo que o esperava. Era a luz acesa no esgoto e a familia para quem ele queria voltar.",
    fragmentAsset: "industrial",
    nextPhaseId: "fase1",
  },
] as const;

/**
 * Recortes curtos dos mapas já conhecidos. Os quatro setores ativos medem
 * 9.600 px (aprox. 30 s a 320 px/s); o Esgoto é o trecho contemplativo e
 * deliberadamente curto do epílogo, depois que todos os implantes saíram.
 */
export const DESCENT_ROUTES: readonly DescentRoute[] = [
  {
    phaseId: "fase5",
    title: "D1 — TOPO // QUEM ALEX ERA",
    startX: 19_400,
    startY: 560,
    endX: 29_000,
    targetSeconds: 30,
    requiredAbilities: ["legs", "arms", "eyes", "thrusters"],
  },
  {
    phaseId: "fase4",
    title: "D2 — CORPORATIVO // A VOZ DA RUA",
    startX: 20_000,
    startY: 560,
    endX: 29_600,
    targetSeconds: 30,
    requiredAbilities: ["legs", "arms", "eyes"],
    attackBarrierX: 23_936,
    hidePreviousMapContent: true,
  },
  {
    phaseId: "fase3",
    title: "D3 — MEIO URBANO // OS AMIGOS",
    startX: 20_000,
    startY: 560,
    endX: 29_600,
    targetSeconds: 30,
    requiredAbilities: ["legs", "arms"],
    doubleJumpHazard: { x: 25_920, width: 320 },
    enemySafeStartPx: 160,
  },
  {
    phaseId: "fase2-intro",
    title: "D4 — INDUSTRIAL // A FAMÍLIA",
    startX: 20_480,
    startY: 560,
    endX: 30_080,
    targetSeconds: 30,
    requiredAbilities: ["legs"],
    doubleJumpHazard: { x: 26_848, width: 320 },
  },
  {
    phaseId: "fase1",
    title: "EPÍLOGO — ESGOTO // O CAMINHO DE CASA",
    startX: 26_400,
    startY: 560,
    endX: 28_864,
    targetSeconds: 8,
    requiredAbilities: [],
    epilogue: true,
  },
] as const;

export function descentStepForPhase(phaseId: string): DescentStep | undefined {
  return DESCENT_STEPS.find((step) => step.phaseId === phaseId);
}

export function descentStepAt(index: number): DescentStep | undefined {
  return DESCENT_STEPS[index];
}

export function isDescentPhase(phaseId: string): phaseId is DescentPhaseId {
  return DESCENT_STEPS.some((step) => step.phaseId === phaseId);
}

export function descentRouteForPhase(phaseId: string): DescentRoute | undefined {
  return DESCENT_ROUTES.find((route) => route.phaseId === phaseId);
}
