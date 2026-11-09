import type { AbilityState } from "./AbilityState";

export type DescentPhaseId = "fase5" | "fase4" | "fase3" | "fase2-intro";

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

export function descentStepForPhase(phaseId: string): DescentStep | undefined {
  return DESCENT_STEPS.find((step) => step.phaseId === phaseId);
}

export function descentStepAt(index: number): DescentStep | undefined {
  return DESCENT_STEPS[index];
}

export function isDescentPhase(phaseId: string): phaseId is DescentPhaseId {
  return DESCENT_STEPS.some((step) => step.phaseId === phaseId);
}
