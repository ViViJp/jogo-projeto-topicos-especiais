import { STORAGE_KEY } from "../config/GameConfig";
import { AbilityState, createInitialAbilityState } from "./AbilityState";

/**
 * Formato do save - GDD seção 20.1.
 * "Existe um único save de campanha" persistido via localStorage.
 *
 * Este protótipo implementa fase atual, checkpoint, carteira, créditos
 * consolidados e implantes (os campos necessários para os Marcos 1 e 2).
 * Os campos `descentState`, `fragments` e `endings` já existem no shape
 * para que a equipe de narrativa (Marco 4) só precise preencher a lógica,
 * sem precisar migrar o formato do save.
 */
export interface SaveData {
  version: 1;
  currentPhaseId: string;
  checkpoint: {
    x: number;
    consolidatedCreditIds: string[];
  };
  wallet: number;
  abilities: AbilityState;
  /** Seção 18 - preenchido a partir do Marco 4 (descida Flesh/Hollow). */
  descentState: {
    active: boolean;
    brokenChain: boolean;
    recoveredFragmentIds: string[];
  };
  /** Seção 20.2/20.3 - save narrativo automático antes da escolha do Portão. */
  preGateSave: SaveData | null;
  endingReached: "chrome" | "flesh" | "hollow" | null;
}

function defaultSave(): SaveData {
  return {
    version: 1,
    currentPhaseId: "fase1",
    checkpoint: { x: 0, consolidatedCreditIds: [] },
    wallet: 0,
    abilities: createInitialAbilityState(),
    descentState: { active: false, brokenChain: false, recoveredFragmentIds: [] },
    preGateSave: null,
    endingReached: null,
  };
}

export class SaveState {
  private data: SaveData;

  private constructor(data: SaveData) {
    this.data = data;
  }

  static hasExistingSave(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  static load(): SaveState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new SaveState(defaultSave());
      const parsed = JSON.parse(raw) as SaveData;
      return new SaveState({ ...defaultSave(), ...parsed });
    } catch (err) {
      console.warn("[SaveState] save corrompido, iniciando novo estado", err);
      return new SaveState(defaultSave());
    }
  }

  /** Seção 20.2 - Novo Jogo: apaga somente depois de confirmação (a confirmação é responsabilidade da MenuScene). */
  static newGame(): SaveState {
    const fresh = new SaveState(defaultSave());
    fresh.persist();
    return fresh;
  }

  get(): Readonly<SaveData> {
    return this.data;
  }

  updateCheckpoint(x: number, consolidatedCreditIds: string[], wallet: number): void {
    this.data.checkpoint = { x, consolidatedCreditIds };
    this.data.wallet = wallet;
    this.persist();
  }

  setPhase(phaseId: string): void {
    this.data.currentPhaseId = phaseId;
    this.data.checkpoint = { x: 0, consolidatedCreditIds: [] };
    this.persist();
  }

  unlockAbility(key: keyof AbilityState): void {
    this.data.abilities[key] = true;
    this.persist();
  }

  persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }
}
