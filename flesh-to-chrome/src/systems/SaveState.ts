import { STORAGE_KEY } from "../config/GameConfig";
import { CloudSession } from "../network/CloudSession";
import { AbilityState, createCompleteAbilityState, createInitialAbilityState } from "./AbilityState";
import { DESCENT_STEPS, descentStepAt, descentStepForPhase } from "./DescentProgression";

export interface DescentState {
  active: boolean;
  brokenChain: boolean;
  /** Última ReForge concluída; o corredor jogável do Esgoto ainda não terminou. */
  epiloguePending: boolean;
  currentStep: number;
  recoveredFragmentIds: string[];
  retryUsedPhaseIds: string[];
  pendingRemoval: keyof AbilityState | null;
}

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
  descentState: DescentState;
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
      brokenChain: false,
      epiloguePending: false,
      currentStep: 0,
      recoveredFragmentIds: [],
      retryUsedPhaseIds: [],
      pendingRemoval: null,
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
      brokenChain: data.descentState.brokenChain,
      epiloguePending: data.descentState.epiloguePending,
      currentStep: data.descentState.currentStep,
      recoveredFragmentIds: [...data.descentState.recoveredFragmentIds],
      retryUsedPhaseIds: [...data.descentState.retryUsedPhaseIds],
      pendingRemoval: data.descentState.pendingRemoval,
    },
    preGateSave: includePreGateSave && data.preGateSave
      ? cloneSaveData(data.preGateSave, false)
      : null,
    endingReached: data.endingReached,
  };
}

function normalizeSaveData(parsed: Partial<SaveData>, volatileFragmentId?: string): SaveData {
  const fresh = defaultSave();
  const checkpoint = parsed.checkpoint ?? fresh.checkpoint;
  const descentState = (parsed.descentState ?? fresh.descentState) as Partial<DescentState> & {
    chainStatus?: "inactive" | "active" | "broken" | "complete";
    memories?: string[];
    pendingMemory?: string | null;
    removals?: string[];
    retryUsedByStage?: Record<string, boolean>;
  };
  const endingReached = ["chrome", "flesh", "hollow"].includes(parsed.endingReached ?? "")
    ? parsed.endingReached as SaveData["endingReached"]
    : null;
  const legacyPairCount = Math.min(
    Array.isArray(descentState.memories) ? descentState.memories.length : 0,
    Array.isArray(descentState.removals) ? descentState.removals.length : 0,
  );
  const currentStep = Number.isInteger(descentState.currentStep)
    ? Math.max(0, Math.min(DESCENT_STEPS.length, descentState.currentStep ?? 0))
    : Math.min(DESCENT_STEPS.length, legacyPairCount);
  const storedFragments = Array.isArray(descentState.recoveredFragmentIds)
    ? descentState.recoveredFragmentIds
    : DESCENT_STEPS.slice(0, legacyPairCount).map((step) => step.fragmentId);
  const recoveredFragmentIds = DESCENT_STEPS.slice(0, currentStep).map((step) => step.fragmentId);
  const pendingStep = descentStepAt(currentStep);
  const preserveVolatileFragment = Boolean(
    pendingStep &&
    volatileFragmentId === pendingStep.fragmentId &&
    (storedFragments.includes(pendingStep.fragmentId) || descentState.pendingMemory),
  );
  if (preserveVolatileFragment && pendingStep) recoveredFragmentIds.push(pendingStep.fragmentId);
  const retryPhaseByStage: Record<string, string> = {
    topo: "fase5",
    corporativo: "fase4",
    "meio-urbano": "fase3",
    industrial: "fase2-intro",
  };
  const legacyRetries = descentState.retryUsedByStage
    ? Object.entries(descentState.retryUsedByStage)
      .filter(([, used]) => used)
      .map(([stage]) => retryPhaseByStage[stage])
      .filter((phaseId): phaseId is string => Boolean(phaseId))
    : [];
  const brokenChain = Boolean(descentState.brokenChain || descentState.chainStatus === "broken");
  const completedChain = currentStep >= DESCENT_STEPS.length || descentState.chainStatus === "complete";
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
      active: Boolean(descentState.active) && !brokenChain && !completedChain,
      brokenChain,
      epiloguePending: Boolean(descentState.epiloguePending)
        || (completedChain && endingReached === null && !descentState.active),
      currentStep,
      recoveredFragmentIds,
      retryUsedPhaseIds: Array.isArray(descentState.retryUsedPhaseIds)
        ? [...descentState.retryUsedPhaseIds]
        : legacyRetries,
      pendingRemoval: preserveVolatileFragment && ["legs", "arms", "eyes", "thrusters"].includes(descentState.pendingRemoval ?? "")
        ? descentState.pendingRemoval as keyof AbilityState
        : null,
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
const volatilePendingFragments = new Map<string, string>();

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
      data.descentState.brokenChain ||
      data.descentState.epiloguePending ||
      data.descentState.currentStep > 0 ||
      data.descentState.recoveredFragmentIds.length > 0 ||
      data.descentState.retryUsedPhaseIds.length > 0 ||
      data.descentState.pendingRemoval !== null
    );
  }

  static readStored(store: SaveStore, key: string): SaveData | null {
    try {
      const raw = readRaw(store, key);
      if (!raw) return null;
      const normalized = normalizeSaveData(
        JSON.parse(raw) as Partial<SaveData>,
        volatilePendingFragments.get(key),
      );
      writeRaw(store, key, JSON.stringify(normalized));
      return normalized;
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
    if (guest) {
      localStorage.setItem(accountKey(userId), JSON.stringify(guest));
      const pending = volatilePendingFragments.get(sessionKey());
      if (pending) volatilePendingFragments.set(accountKey(userId), pending);
    }
    volatilePendingFragments.delete(sessionKey());
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
    volatilePendingFragments.delete(place.key);
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

  /** Inicia a revisita ao Topo sem apagar o snapshot pre-Portao. */
  beginDescent(): void {
    // O Portão só existe depois da conversão dos quatro implantes. Além de
    // proteger saves antigos, isto mantém o início narrativo da descida fiel
    // ao Portão da campanha e seleciona o sprite Alex completo.
    this.data.abilities = createCompleteAbilityState();
    this.data.descentState = {
      active: true,
      brokenChain: false,
      epiloguePending: false,
      currentStep: 0,
      recoveredFragmentIds: [],
      retryUsedPhaseIds: [],
      pendingRemoval: null,
    };
    this.data.currentPhaseId = DESCENT_STEPS[0].phaseId;
    this.data.checkpoint = { x: 0, y: 0, consolidatedCreditIds: [] };
    this.data.wallet = 0;
    this.data.endingReached = null;
    volatilePendingFragments.delete(this.place.key);
    this.persist();
  }

  isDescentActive(): boolean {
    return this.data.descentState.active;
  }

  recoverDescentFragment(fragmentId: string): boolean {
    const step = descentStepAt(this.data.descentState.currentStep);
    if (!this.data.descentState.active || this.data.descentState.brokenChain || !step) return false;
    if (step.phaseId !== this.data.currentPhaseId || step.fragmentId !== fragmentId) return false;
    if (!this.data.descentState.recoveredFragmentIds.includes(fragmentId)) {
      this.data.descentState.recoveredFragmentIds.push(fragmentId);
      volatilePendingFragments.set(this.place.key, fragmentId);
      this.persist();
    }
    return true;
  }

  hasRecoveredCurrentFragment(): boolean {
    const step = descentStepAt(this.data.descentState.currentStep);
    return Boolean(step && this.data.descentState.recoveredFragmentIds.includes(step.fragmentId));
  }

  /** Descarta somente a memória ainda não consolidada pela ReForge atual. */
  discardPendingDescentMemory(): boolean {
    const descent = this.data.descentState;
    const step = descentStepAt(descent.currentStep);
    if (!step) return false;
    const before = descent.recoveredFragmentIds.length;
    descent.recoveredFragmentIds = descent.recoveredFragmentIds.filter((id) => id !== step.fragmentId);
    const changed = before !== descent.recoveredFragmentIds.length || descent.pendingRemoval !== null;
    descent.pendingRemoval = null;
    volatilePendingFragments.delete(this.place.key);
    if (changed) this.persist();
    return changed;
  }

  /** Resultado da chegada ao fim de um setor da descida. */
  completeDescentPhase(): "reforge" | "retry" | "hollow" {
    const step = descentStepAt(this.data.descentState.currentStep);
    if (!step || step.phaseId !== this.data.currentPhaseId || this.data.descentState.brokenChain) {
      this.breakDescentChain();
      return "hollow";
    }
    if (this.data.descentState.recoveredFragmentIds.includes(step.fragmentId)) {
      this.data.descentState.pendingRemoval = step.implant;
      this.persist();
      return "reforge";
    }
    if (this.data.descentState.retryUsedPhaseIds.includes(step.phaseId)) {
      this.breakDescentChain();
      return "hollow";
    }
    // A oportunidade e consumida ao concluir a fase sem o glitch, nao por morte/reinicio manual.
    this.data.descentState.retryUsedPhaseIds.push(step.phaseId);
    this.data.checkpoint = { x: 0, y: 0, consolidatedCreditIds: [] };
    this.persist();
    return "retry";
  }

  declineDescentRetry(): void {
    this.breakDescentChain();
  }

  private breakDescentChain(): void {
    this.data.descentState.brokenChain = true;
    this.data.descentState.active = false;
    this.data.descentState.epiloguePending = false;
    this.data.descentState.pendingRemoval = null;
    volatilePendingFragments.delete(this.place.key);
    this.data.checkpoint = { x: 0, y: 0, consolidatedCreditIds: [] };
    this.persist();
  }

  /** Confirma a troca ReForge e avanca somente depois da remocao persistida. */
  completeBioprinting(): { nextPhaseId: string; finished: boolean } | null {
    const descent = this.data.descentState;
    const step = descentStepAt(descent.currentStep);
    if (!descent.active || !step || descent.pendingRemoval !== step.implant) return null;
    this.data.abilities[step.implant] = false;
    descent.pendingRemoval = null;
    descent.currentStep += 1;
    volatilePendingFragments.delete(this.place.key);
    this.data.currentPhaseId = step.nextPhaseId;
    this.data.checkpoint = { x: 0, y: 0, consolidatedCreditIds: [] };
    this.data.wallet = 0;
    const finished = descent.currentStep >= DESCENT_STEPS.length;
    if (finished) {
      descent.active = false;
      descent.epiloguePending = true;
    }
    this.persist();
    return { nextPhaseId: step.nextPhaseId, finished };
  }

  /** Registra que Alex percorreu o último trecho antes de abrir o epílogo Flesh. */
  completeDescentEpilogue(): boolean {
    const descent = this.data.descentState;
    if (!descent.epiloguePending || descent.currentStep < DESCENT_STEPS.length) return false;
    descent.epiloguePending = false;
    this.data.checkpoint = { x: 0, y: 0, consolidatedCreditIds: [] };
    this.persist();
    return true;
  }

  /** Ajuda de consistencia para saves antigos/interrompidos. */
  currentDescentImplant(): keyof AbilityState | null {
    return descentStepForPhase(this.data.currentPhaseId)?.implant ?? null;
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

  /**
   * Aplica a restauração localmente sem usar o PUT normal da campanha.
   * Para uma conta autenticada, `confirmed` deve ser o estado devolvido por
   * POST /me/campaign/restore-gate; visitantes restauram o snapshot da sessão.
   */
  restorePreGateSave(confirmed?: SaveData): Readonly<SaveData> | null {
    if (!confirmed && this.place.store === "account") return null;
    if (!confirmed && !this.data.preGateSave) return null;
    if (confirmed) {
      this.data = cloneSaveData(confirmed);
    } else {
      const snapshot = cloneSaveData(this.data.preGateSave!, false);
      this.data = {
        ...cloneSaveData(snapshot, false),
        preGateSave: cloneSaveData(snapshot, false),
        endingReached: null,
      };
    }
    writeRaw(this.place.store, this.place.key, JSON.stringify(this.data));
    return this.data;
  }

  markEndingReached(ending: Exclude<SaveData["endingReached"], null>): void {
    this.data.endingReached = ending;
    this.data.descentState.epiloguePending = false;
    this.persist();
  }

  persist(): void {
    writeRaw(this.place.store, this.place.key, JSON.stringify(this.data));
    if (this.place.store === "account") {
      CloudSession.queueCampaignSync(cloneSaveData(this.data));
    }
  }
}
