import { AbilityState, createCompleteAbilityState } from "./AbilityState";
import { DESCENT_STEPS, descentStepAt } from "./DescentProgression";

export interface DescentPreviewState {
  active: boolean;
  brokenChain: boolean;
  epiloguePending: boolean;
  currentStep: number;
  recoveredFragmentIds: string[];
  retryUsedPhaseIds: string[];
  pendingRemoval: keyof AbilityState | null;
}

export interface DescentPreviewData {
  currentPhaseId: string;
  abilities: AbilityState;
  descentState: DescentPreviewState;
}

/**
 * Progressão descartável usada pela prévia do Portão.
 *
 * Ela reproduz as mesmas regras narrativas do SaveState, mas existe apenas
 * enquanto as cenas da prévia estão abertas e nunca acessa localStorage.
 */
export class DescentPreviewSession {
  private readonly data: DescentPreviewData = {
    currentPhaseId: DESCENT_STEPS[0].phaseId,
    abilities: createCompleteAbilityState(),
    descentState: {
      active: true,
      brokenChain: false,
      epiloguePending: false,
      currentStep: 0,
      recoveredFragmentIds: [],
      retryUsedPhaseIds: [],
      pendingRemoval: null,
    },
  };

  get(): Readonly<DescentPreviewData> {
    return this.data;
  }

  recoverDescentFragment(fragmentId: string): boolean {
    const descent = this.data.descentState;
    const step = descentStepAt(descent.currentStep);
    if (!descent.active || descent.brokenChain || !step) return false;
    if (step.phaseId !== this.data.currentPhaseId || step.fragmentId !== fragmentId) return false;
    if (!descent.recoveredFragmentIds.includes(fragmentId)) {
      descent.recoveredFragmentIds.push(fragmentId);
    }
    return true;
  }

  completeDescentPhase(): "reforge" | "retry" | "hollow" {
    const descent = this.data.descentState;
    const step = descentStepAt(descent.currentStep);
    if (!step || step.phaseId !== this.data.currentPhaseId || descent.brokenChain) {
      this.breakChain();
      return "hollow";
    }
    if (descent.recoveredFragmentIds.includes(step.fragmentId)) {
      descent.pendingRemoval = step.implant;
      return "reforge";
    }
    if (descent.retryUsedPhaseIds.includes(step.phaseId)) {
      this.breakChain();
      return "hollow";
    }
    descent.retryUsedPhaseIds.push(step.phaseId);
    return "retry";
  }

  declineDescentRetry(): void {
    this.breakChain();
  }

  completeBioprinting(): { nextPhaseId: string; finished: boolean } | null {
    const descent = this.data.descentState;
    const step = descentStepAt(descent.currentStep);
    if (!descent.active || !step || descent.pendingRemoval !== step.implant) return null;
    this.data.abilities[step.implant] = false;
    descent.pendingRemoval = null;
    descent.currentStep += 1;
    this.data.currentPhaseId = step.nextPhaseId;
    const finished = descent.currentStep >= DESCENT_STEPS.length;
    if (finished) {
      descent.active = false;
      descent.epiloguePending = true;
    }
    return { nextPhaseId: step.nextPhaseId, finished };
  }

  completeDescentEpilogue(): boolean {
    const descent = this.data.descentState;
    if (!descent.epiloguePending || descent.currentStep < DESCENT_STEPS.length) return false;
    descent.epiloguePending = false;
    return true;
  }

  private breakChain(): void {
    const descent = this.data.descentState;
    descent.brokenChain = true;
    descent.active = false;
    descent.epiloguePending = false;
    descent.pendingRemoval = null;
  }
}
