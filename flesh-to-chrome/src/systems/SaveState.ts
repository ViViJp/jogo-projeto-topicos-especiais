import { STORAGE_KEY } from "../config/GameConfig";
import { CloudSession } from "../network/CloudSession";
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
    step: string | null;
    chainStatus: "inactive" | "active" | "broken" | "complete";
    memories: string[];
    pendingMemory: string | null;
    removals: string[];
    retryUsedByStage: Record<string, boolean>;
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
    descentState: {
      active: false,
      step: null,
      chainStatus: "inactive",
      memories: [],
      pendingMemory: null,
      removals: [],
      retryUsedByStage: {},
    },
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
      step: data.descentState.step,
      chainStatus: data.descentState.chainStatus,
      memories: [...data.descentState.memories],
      pendingMemory: data.descentState.pendingMemory,
      removals: [...data.descentState.removals],
      retryUsedByStage: { ...data.descentState.retryUsedByStage },
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
  const legacyDescent = descentState as typeof descentState & {
    brokenChain?: boolean;
    recoveredFragmentIds?: string[];
  };
  const chainStatus = ["inactive", "active", "broken", "complete"].includes(descentState.chainStatus)
    ? descentState.chainStatus
    : legacyDescent.brokenChain
      ? "broken"
      : descentState.active
        ? "active"
        : "inactive";
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
      active: Boolean(descentState.active),
      step: typeof descentState.step === "string" ? descentState.step : null,
      chainStatus: chainStatus as SaveData["descentState"]["chainStatus"],
      memories: Array.isArray(descentState.memories)
        ? [...descentState.memories]
        : Array.isArray(legacyDescent.recoveredFragmentIds)
          ? [...legacyDescent.recoveredFragmentIds]
          : [],
      pendingMemory: typeof descentState.pendingMemory === "string" ? descentState.pendingMemory : null,
      removals: Array.isArray(descentState.removals) ? [...descentState.removals] : [],
      retryUsedByStage: descentState.retryUsedByStage && typeof descentState.retryUsedByStage === "object"
        ? { ...descentState.retryUsedByStage }
        : {},
    },
    preGateSave: null,
    endingReached,
  };
  if (parsed.preGateSave) {
    normalized.preGateSave = normalizeSaveData({ ...parsed.preGateSave, preGateSave: null });
  }
  return normalized;
}

type SaveStore = "session" | "account";

let ownerChosen = false;
let ownerId: string | null = null;
let guestBooted = false;

function sessionKey(): string {
  return `${STORAGE_KEY}:session`;
}

function accountKey(userId: string): string {
  return `${STORAGE_KEY}:account:${userId}`;
}

function activeStore(): { store: SaveStore; key: string } {
  if (ownerChosen && ownerId) return { store: "account", key: accountKey(ownerId) };
  if (ownerChosen) return { store: "session", key: sessionKey() };
  const session = CloudSession.current();
  if (session) return { store: "account", key: accountKey(session.profile.id) };
  const remembered = CloudSession.storedOwner();
  if (remembered) return { store: "account", key: accountKey(remembered) };
  return { store: "session", key: sessionKey() };
}

function readRaw(store: SaveStore, key: string): string | null {
  return (store === "session" ? sessionStorage : localStorage).getItem(key);
}

function writeRaw(store: SaveStore, key: string, value: string): void {
  (store === "session" ? sessionStorage : localStorage).setItem(key, value);
}

export class SaveState {
  private data: SaveData;
  private place: { store: SaveStore; key: string };

  private constructor(data: SaveData, place: { store: SaveStore; key: string }) {
    this.data = data;
    this.place = place;
  }

  static sessionKey(): string {
    return sessionKey();
  }

  static accountKey(userId: string): string {
    return accountKey(userId);
  }

  static hasProgress(data: SaveData): boolean {
    const abilities = Object.values(data.abilities).some(Boolean);
    return (
      data.currentPhaseId !== "fase1" ||
      data.checkpoint.x !== 0 ||
      data.checkpoint.y !== 0 ||
      data.checkpoint.consolidatedCreditIds.length > 0 ||
      data.wallet !== 0 ||
      abilities ||
      data.preGateSave !== null ||
      data.endingReached !== null ||
      data.descentState.active ||
      data.descentState.memories.length > 0 ||
      data.descentState.pendingMemory !== null ||
      data.descentState.removals.length > 0
    );
  }

  static readStored(store: SaveStore, key: string): SaveData | null {
    try {
      const raw = readRaw(store, key);
      if (!raw) return null;
      return normalizeSaveData(JSON.parse(raw) as Partial<SaveData>);
    } catch {
      return null;
    }
  }

  static bootGuest(): void {
    if (guestBooted) return;
    guestBooted = true;
    if (!new URLSearchParams(window.location.search).get("ticket")) {
      sessionStorage.removeItem(sessionKey());
    }
  }

  static bindAccount(userId: string): void {
    ownerChosen = true;
    ownerId = userId;
  }

  static bindSession(): void {
    ownerChosen = true;
    ownerId = null;
  }

  static prefer(store: SaveStore): void {
    if (store === "session") SaveState.bindSession();
    else {
      const session = CloudSession.current();
      if (session) SaveState.bindAccount(session.profile.id);
      else SaveState.bindSession();
    }
  }

  static importSession(userId: string): void {
    const guest = SaveState.readStored("session", sessionKey());
    if (guest) localStorage.setItem(accountKey(userId), JSON.stringify(guest));
    sessionStorage.removeItem(sessionKey());
    SaveState.bindAccount(userId);
  }

  static keepAccount(userId?: string): void {
    const id = userId || ownerId || CloudSession.current()?.profile.id || "";
    sessionStorage.removeItem(sessionKey());
    if (!id) {
      SaveState.bindSession();
      return;
    }
    SaveState.bindAccount(id);
  }

  static keepSession(): void {
    SaveState.bindSession();
  }

  static logoutLocal(): void {
    sessionStorage.removeItem(sessionKey());
    SaveState.bindSession();
  }

  static hasExistingSave(): boolean {
    const place = activeStore();
    const stored = SaveState.readStored(place.store, place.key);
    return stored !== null && SaveState.hasProgress(stored);
  }

  static load(): SaveState {
    const place = activeStore();
    const stored = SaveState.readStored(place.store, place.key);
    return new SaveState(stored ?? defaultSave(), place);
  }

  /** Seção 20.2 - Novo Jogo: apaga somente depois de confirmação (a confirmação é responsabilidade da MenuScene). */
  static newGame(): SaveState {
    const place = activeStore();
    const fresh = new SaveState(defaultSave(), place);
    writeRaw(place.store, place.key, JSON.stringify(fresh.data));
    if (place.store === "account") CloudSession.queueCampaignReset(cloneSaveData(fresh.data));
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
    this.data.checkpoint = {
      x: 0,
      y: 0,
      consolidatedCreditIds: [...this.data.checkpoint.consolidatedCreditIds],
    };
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
    writeRaw(this.place.store, this.place.key, JSON.stringify(this.data));
    if (this.place.store === "account") {
      CloudSession.queueCampaignSync(cloneSaveData(this.data));
    }
  }
}
