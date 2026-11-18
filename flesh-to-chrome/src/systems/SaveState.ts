import { STORAGE_KEY } from "../config/GameConfig";
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
  /**
   * Setor cuja tela de retry ainda aguarda uma decisão do jogador.
   * Diferente de `retryUsedPhaseIds`, este campo distingue a tela de escolha
   * da segunda tentativa já iniciada e sobrevive ao fechamento do jogo.
   */
  pendingRetryChoicePhaseId: string | null;
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
      pendingRetryChoicePhaseId: null,
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
      pendingRetryChoicePhaseId: data.descentState.pendingRetryChoicePhaseId,
    },
    preGateSave: includePreGateSave && data.preGateSave
      ? cloneSaveData(data.preGateSave, false)
      : null,
    endingReached: data.endingReached,
  };
}

const CAMPAIGN_PHASE_IDS = ["fase1", "fase2-intro", "fase3", "fase4", "fase5"] as const;
type CampaignPhaseId = typeof CAMPAIGN_PHASE_IDS[number];

const PHASE_BOUNDS: Record<CampaignPhaseId, { width: number; height: number }> = {
  fase1: { width: 30_400, height: 720 },
  "fase2-intro": { width: 30_720, height: 720 },
  fase3: { width: 30_720, height: 720 },
  fase4: { width: 30_720, height: 720 },
  fase5: { width: 38_400, height: 720 },
};

const ABILITY_KEYS: readonly (keyof AbilityState)[] = ["legs", "arms", "eyes", "thrusters"];
const MAX_WALLET = 999_999_999;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCampaignPhaseId(value: unknown): value is CampaignPhaseId {
  return typeof value === "string" && (CAMPAIGN_PHASE_IDS as readonly string[]).includes(value);
}

function uniqueStrings(value: unknown, predicate: (entry: string) => boolean): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => (
    typeof entry === "string" && entry.length <= 96 && predicate(entry)
  )))];
}

function normalizedWallet(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(MAX_WALLET, Math.trunc(value));
}

function ascentAbilitiesForPhase(phaseId: CampaignPhaseId): AbilityState {
  const phaseIndex = CAMPAIGN_PHASE_IDS.indexOf(phaseId);
  return {
    legs: phaseIndex >= 1,
    arms: phaseIndex >= 2,
    eyes: phaseIndex >= 3,
    thrusters: phaseIndex >= 4,
  };
}

function descentAbilitiesForStep(currentStep: number): AbilityState {
  const abilities = createCompleteAbilityState();
  for (let index = 0; index < Math.min(currentStep, DESCENT_STEPS.length); index += 1) {
    abilities[DESCENT_STEPS[index].implant] = false;
  }
  return abilities;
}

function normalizeSaveData(parsedValue: unknown, includePreGateSave = true): SaveData {
  const parsed = isRecord(parsedValue) ? parsedValue : {};
  const rawDescent = isRecord(parsed.descentState) ? parsed.descentState : {};
  const rawCheckpoint = isRecord(parsed.checkpoint) ? parsed.checkpoint : {};
  const endingReached = ["chrome", "flesh", "hollow"].includes(String(parsed.endingReached ?? ""))
    ? parsed.endingReached as SaveData["endingReached"]
    : null;
  let currentStep = typeof rawDescent.currentStep === "number" && Number.isInteger(rawDescent.currentStep)
    ? Math.max(0, Math.min(DESCENT_STEPS.length, rawDescent.currentStep))
    : 0;
  let active = rawDescent.active === true;
  let brokenChain = rawDescent.brokenChain === true;
  let epiloguePending = rawDescent.epiloguePending === true;

  if (endingReached === "flesh") {
    currentStep = DESCENT_STEPS.length;
    active = false;
    brokenChain = false;
    epiloguePending = false;
  } else if (endingReached === "hollow") {
    active = false;
    brokenChain = true;
    epiloguePending = false;
  } else if (endingReached === "chrome") {
    currentStep = 0;
    active = false;
    brokenChain = false;
    epiloguePending = false;
  } else if (brokenChain) {
    active = false;
    epiloguePending = false;
  } else if (currentStep >= DESCENT_STEPS.length) {
    active = false;
  } else if (currentStep > 0) {
    // Uma etapa intermediária só é alcançada após uma ReForge concluída.
    // Se um save parcial perdeu o flag, retomar a descida é mais seguro do
    // que abrir a fase como se ainda fosse a campanha de subida.
    active = true;
    epiloguePending = false;
  }

  const hasDescentProgress = active || brokenChain || epiloguePending || currentStep > 0
    || endingReached === "flesh" || endingReached === "hollow";
  const ascentPhaseId: CampaignPhaseId = isCampaignPhaseId(parsed.currentPhaseId)
    ? parsed.currentPhaseId
    : "fase1";
  const currentPhaseId: CampaignPhaseId = hasDescentProgress
    ? (currentStep < DESCENT_STEPS.length
      ? DESCENT_STEPS[currentStep].phaseId
      : "fase1")
    : ascentPhaseId;

  const knownFragments = new Set(DESCENT_STEPS.map((step) => step.fragmentId));
  const recoveredFromSave = new Set(uniqueStrings(
    rawDescent.recoveredFragmentIds,
    (entry) => knownFragments.has(entry),
  ));
  const recoveredFragmentIds: string[] = [];
  for (let index = 0; index < currentStep; index += 1) {
    recoveredFragmentIds.push(DESCENT_STEPS[index].fragmentId);
  }

  const currentDescentStep = descentStepAt(currentStep);
  const rawPendingRemoval = typeof rawDescent.pendingRemoval === "string"
    && ABILITY_KEYS.includes(rawDescent.pendingRemoval as keyof AbilityState)
    ? rawDescent.pendingRemoval as keyof AbilityState
    : null;
  const pendingRemoval = active && currentDescentStep && rawPendingRemoval === currentDescentStep.implant
    ? rawPendingRemoval
    : null;
  if (currentDescentStep && (recoveredFromSave.has(currentDescentStep.fragmentId) || pendingRemoval)) {
    recoveredFragmentIds.push(currentDescentStep.fragmentId);
  }

  const phaseIndexById = new Map<string, number>(DESCENT_STEPS.map((step, index) => [step.phaseId, index]));
  const retryUsedPhaseIds = uniqueStrings(
    rawDescent.retryUsedPhaseIds,
    (entry) => (phaseIndexById.get(entry) ?? Number.POSITIVE_INFINITY) <= currentStep,
  );
  const currentFragmentRecovered = Boolean(
    currentDescentStep && recoveredFragmentIds.includes(currentDescentStep.fragmentId),
  );
  const savedPendingRetry = rawDescent.pendingRetryChoicePhaseId;
  const pendingFieldExists = Object.prototype.hasOwnProperty.call(rawDescent, "pendingRetryChoicePhaseId");
  const migrateInterruptedRetry = !pendingFieldExists
    && currentDescentStep
    && retryUsedPhaseIds.includes(currentDescentStep.phaseId);
  const pendingRetryChoicePhaseId = active
    && currentDescentStep
    && !pendingRemoval
    && !currentFragmentRecovered
    && retryUsedPhaseIds.includes(currentDescentStep.phaseId)
    && (savedPendingRetry === currentDescentStep.phaseId || migrateInterruptedRetry)
    ? currentDescentStep.phaseId
    : null;

  const bounds = PHASE_BOUNDS[currentPhaseId];
  const checkpointX = typeof rawCheckpoint.x === "number" ? rawCheckpoint.x : Number.NaN;
  const checkpointY = typeof rawCheckpoint.y === "number" ? rawCheckpoint.y : Number.NaN;
  const validCoordinates = Number.isFinite(checkpointX)
    && Number.isFinite(checkpointY)
    && checkpointX >= 0
    && checkpointY >= 0
    && checkpointX <= bounds.width
    && checkpointY <= bounds.height
    && ((checkpointX === 0 && checkpointY === 0) || (checkpointX > 0 && checkpointY >= 64));
  const maxCreditPhase = CAMPAIGN_PHASE_IDS.indexOf(currentPhaseId) + 1;
  const consolidatedCreditIds = hasDescentProgress
    ? []
    : uniqueStrings(rawCheckpoint.consolidatedCreditIds, (entry) => {
      const match = /^f([1-5])-[a-z0-9-]+$/i.exec(entry);
      return Boolean(match && Number(match[1]) <= maxCreditPhase);
    });

  const normalized: SaveData = {
    version: 1,
    currentPhaseId,
    checkpoint: {
      x: validCoordinates ? checkpointX : 0,
      y: validCoordinates ? checkpointY : 0,
      consolidatedCreditIds,
    },
    wallet: hasDescentProgress ? 0 : normalizedWallet(parsed.wallet),
    // O progresso da campanha é a fonte de verdade. Isso também elimina
    // strings/números truthy injetados em campos que deveriam ser booleanos.
    abilities: hasDescentProgress
      ? descentAbilitiesForStep(currentStep)
      : ascentAbilitiesForPhase(currentPhaseId),
    descentState: {
      active,
      brokenChain,
      epiloguePending: epiloguePending && currentStep >= DESCENT_STEPS.length,
      currentStep,
      recoveredFragmentIds,
      retryUsedPhaseIds,
      pendingRemoval,
      pendingRetryChoicePhaseId,
    },
    preGateSave: null,
    endingReached,
  };

  if (pendingRetryChoicePhaseId) {
    normalized.checkpoint = { x: 0, y: 0, consolidatedCreditIds: [] };
  }
  if (includePreGateSave && isRecord(parsed.preGateSave)) {
    const preGate = normalizeSaveData({ ...parsed.preGateSave, preGateSave: null }, false);
    // O snapshot narrativo só é seguro se realmente representar o Portão.
    if (preGate.currentPhaseId === "fase5"
      && !preGate.descentState.active
      && !preGate.descentState.brokenChain
      && preGate.descentState.currentStep === 0) {
      normalized.preGateSave = preGate;
    }
  }
  return normalized;
}

export class SaveState {
  private static volatileSave: SaveData | null = null;
  private static storageWarning: string | null = null;
  private data: SaveData;

  private constructor(data: SaveData) {
    this.data = data;
  }

  static hasExistingSave(): boolean {
    if (SaveState.volatileSave && SaveState.storageWarning) return true;
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch (err) {
      SaveState.reportStorageFailure("ler", err);
      return SaveState.volatileSave !== null;
    }
  }

  static load(): SaveState {
    if (SaveState.volatileSave && SaveState.storageWarning) {
      return new SaveState(cloneSaveData(SaveState.volatileSave));
    }
    let raw: string | null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      SaveState.reportStorageFailure("ler", err);
      return new SaveState(SaveState.volatileSave
        ? cloneSaveData(SaveState.volatileSave)
        : defaultSave());
    }
    if (!raw) return new SaveState(defaultSave());
    try {
      const normalized = normalizeSaveData(JSON.parse(raw));
      SaveState.volatileSave = cloneSaveData(normalized);
      return new SaveState(normalized);
    } catch (err) {
      console.warn("[SaveState] save corrompido, iniciando novo estado", err);
      // JSON inválido não significa que o storage inteiro falhou. O estado
      // volátil anterior ainda é preferível a quebrar a campanha em curso.
      return new SaveState(SaveState.volatileSave
        ? cloneSaveData(SaveState.volatileSave)
        : defaultSave());
    }
  }

  /** Mensagem pronta para a UI; `null` significa persistência operacional. */
  static getStorageWarning(): string | null {
    return SaveState.storageWarning;
  }

  private static reportStorageFailure(operation: "ler" | "gravar", err: unknown): void {
    SaveState.storageWarning = operation === "gravar"
      ? "Não foi possível gravar o save neste navegador. O progresso continuará apenas nesta sessão."
      : "O armazenamento local está indisponível. O progresso continuará apenas nesta sessão.";
    console.warn(`[SaveState] falha ao ${operation} localStorage`, err);
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
    this.data = normalizeSaveData({
      ...this.data,
      checkpoint: { x, y, consolidatedCreditIds },
      wallet,
    });
    this.persist();
  }

  setPhase(phaseId: string): void {
    this.data = normalizeSaveData({
      ...this.data,
      currentPhaseId: isCampaignPhaseId(phaseId) ? phaseId : "fase1",
      checkpoint: { x: 0, y: 0, consolidatedCreditIds: [] },
    });
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
      pendingRetryChoicePhaseId: null,
    };
    this.data.currentPhaseId = DESCENT_STEPS[0].phaseId;
    this.data.checkpoint = { x: 0, y: 0, consolidatedCreditIds: [] };
    this.data.wallet = 0;
    this.data.endingReached = null;
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
      this.persist();
    }
    return true;
  }

  hasRecoveredCurrentFragment(): boolean {
    const step = descentStepAt(this.data.descentState.currentStep);
    return Boolean(step && this.data.descentState.recoveredFragmentIds.includes(step.fragmentId));
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
      this.data.descentState.pendingRetryChoicePhaseId = null;
      this.persist();
      return "reforge";
    }
    if (this.data.descentState.retryUsedPhaseIds.includes(step.phaseId)) {
      this.breakDescentChain();
      return "hollow";
    }
    // A oportunidade e consumida ao concluir a fase sem o glitch, nao por morte/reinicio manual.
    this.data.descentState.retryUsedPhaseIds.push(step.phaseId);
    this.data.descentState.pendingRetryChoicePhaseId = step.phaseId;
    this.data.checkpoint = { x: 0, y: 0, consolidatedCreditIds: [] };
    this.persist();
    return "retry";
  }

  /** Confirma a segunda tentativa e fecha somente a pendência da escolha. */
  acceptDescentRetry(): boolean {
    const step = descentStepAt(this.data.descentState.currentStep);
    if (!this.data.descentState.active
      || !step
      || this.data.currentPhaseId !== step.phaseId
      || this.data.descentState.pendingRetryChoicePhaseId !== step.phaseId) {
      return false;
    }
    this.data.descentState.pendingRetryChoicePhaseId = null;
    this.data.checkpoint = { x: 0, y: 0, consolidatedCreditIds: [] };
    this.persist();
    return true;
  }

  declineDescentRetry(): void {
    this.breakDescentChain();
  }

  private breakDescentChain(): void {
    this.data.descentState.brokenChain = true;
    this.data.descentState.active = false;
    this.data.descentState.epiloguePending = false;
    this.data.descentState.pendingRemoval = null;
    this.data.descentState.pendingRetryChoicePhaseId = null;
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
    descent.pendingRetryChoicePhaseId = null;
    descent.currentStep += 1;
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
    this.data.descentState.epiloguePending = false;
    this.persist();
  }

  persist(): boolean {
    // O clone em memória vem primeiro: mesmo que cookies/storage estejam
    // bloqueados, transições entre cenas continuam enxergando o estado novo.
    SaveState.volatileSave = cloneSaveData(this.data);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      SaveState.storageWarning = null;
      return true;
    } catch (err) {
      SaveState.reportStorageFailure("gravar", err);
      return false;
    }
  }
}
