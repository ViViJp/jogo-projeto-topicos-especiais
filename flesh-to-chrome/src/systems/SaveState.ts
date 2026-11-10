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
    /**
     * v0.4.1 - campo novo, aditivo (não quebra o formato documentado na
     * Seção 20.1 nem exige migração: um save antigo sem `y` cai no default
     * 0 via `load()`). Sem isso, "Continuar" a partir de um checkpoint
     * salvo num mapa com mais de uma elevação de chão (caso da Fase 1 desde
     * a v0.4.0) reaparecia o personagem na altura errada - mesmo bug do
     * `GameSceneData.checkpointY`, ver `GameScene.ts`.
     */
    y: number;
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
    checkpoint: { x: 0, y: 0, consolidatedCreditIds: [] },
    wallet: 0,
    abilities: createInitialAbilityState(),
    descentState: { active: false, brokenChain: false, recoveredFragmentIds: [] },
    preGateSave: null,
    endingReached: null,
  };
}

function cloneSaveData(data: SaveData, includePreGateSave = true): SaveData {
  return {
    version: 1,
    currentPhaseId: data.currentPhaseId,
    checkpoint: {
      x: data.checkpoint.x,
      y: data.checkpoint.y,
      consolidatedCreditIds: [...data.checkpoint.consolidatedCreditIds],
    },
    wallet: data.wallet,
    abilities: { ...data.abilities },
    descentState: {
      active: data.descentState.active,
      brokenChain: data.descentState.brokenChain,
      recoveredFragmentIds: [...data.descentState.recoveredFragmentIds],
    },
    preGateSave: includePreGateSave && data.preGateSave
      ? cloneSaveData(data.preGateSave, false)
      : null,
    endingReached: data.endingReached,
  };
}

function normalizeSaveData(parsed: Partial<SaveData>): SaveData {
  const fresh = defaultSave();
  const checkpoint = parsed.checkpoint ?? fresh.checkpoint;
  const descentState = parsed.descentState ?? fresh.descentState;
  const endingReached = ["chrome", "flesh", "hollow"].includes(parsed.endingReached ?? "")
    ? parsed.endingReached as SaveData["endingReached"]
    : null;
  const normalized: SaveData = {
    ...fresh,
    ...parsed,
    version: 1,
    checkpoint: {
      x: Number.isFinite(checkpoint.x) ? checkpoint.x : 0,
      y: Number.isFinite(checkpoint.y) ? checkpoint.y : 0,
      consolidatedCreditIds: Array.isArray(checkpoint.consolidatedCreditIds)
        ? [...checkpoint.consolidatedCreditIds]
        : [],
    },
    abilities: { ...fresh.abilities, ...(parsed.abilities ?? {}) },
    descentState: {
      ...fresh.descentState,
      ...descentState,
      recoveredFragmentIds: Array.isArray(descentState.recoveredFragmentIds)
        ? [...descentState.recoveredFragmentIds]
        : [],
    },
    preGateSave: null,
    endingReached,
  };
  if (parsed.preGateSave) {
    normalized.preGateSave = normalizeSaveData({ ...parsed.preGateSave, preGateSave: null });
  }
  return normalized;
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
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return new SaveState(normalizeSaveData(parsed));
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

  updateCheckpoint(x: number, y: number, consolidatedCreditIds: string[], wallet: number): void {
    this.data.checkpoint = { x, y, consolidatedCreditIds };
    this.data.wallet = wallet;
    this.persist();
  }

  setPhase(phaseId: string): void {
    this.data.currentPhaseId = phaseId;
    this.data.checkpoint = { x: 0, y: 0, consolidatedCreditIds: [] };
    this.persist();
  }

  unlockAbility(key: keyof AbilityState): void {
    this.data.abilities[key] = true;
    this.persist();
  }

  hasPreGateSave(): boolean {
    return this.data.preGateSave !== null;
  }

  /** Seção 18.12: snapshot independente, criado imediatamente antes da escolha. */
  createPreGateSave(): Readonly<SaveData> {
    const snapshot = cloneSaveData({ ...this.data, preGateSave: null, endingReached: null }, false);
    this.data.preGateSave = snapshot;
    this.data.endingReached = null;
    this.persist();
    return snapshot;
  }

  /** Restaura atributos, carteira e progresso sem consumir o ponto pré-Portão. */
  restorePreGateSave(): Readonly<SaveData> | null {
    if (!this.data.preGateSave) return null;
    const snapshot = cloneSaveData(this.data.preGateSave, false);
    this.data = {
      ...cloneSaveData(snapshot, false),
      preGateSave: cloneSaveData(snapshot, false),
      endingReached: null,
    };
    this.persist();
    return this.data;
  }

  markEndingReached(ending: Exclude<SaveData["endingReached"], null>): void {
    this.data.endingReached = ending;
    this.persist();
  }

  persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }
}
