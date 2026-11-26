import { CloudSession } from "./CloudSession";
import { MatchParticipantResult, MatchService, RemoteMatch } from "./MatchService";
import {
  LEGACY_NOTICE,
  StoredResultJob,
  applyAttempt,
  enqueueResult,
  finishPump,
  markSceneClosed,
  mergeStores,
  migrateStore,
  releaseOwnerListeners,
  requestPump,
  retryDelay,
  selectForSend,
  statusNotice,
} from "./match-result-sync";

const STORAGE_KEY = "flesh-to-chrome:match-result:v1";

type Listener = (match: RemoteMatch) => void;
type Store = Record<string, StoredResultJob[]>;

export class MatchResultSync {
  private static store: Store = MatchResultSync.load();
  private static listeners = new Map<string, Listener>();
  private static timer: number | undefined;
  private static pumping = false;
  private static pendingPumps: { ownerId?: string | null; delay: number; retry?: boolean }[] = [];

  static enqueue(job: {
    kind: StoredResultJob["kind"];
    matchId: string;
    operationId: string;
    result?: MatchParticipantResult | null;
    observedOpponent?: MatchParticipantResult | null;
  }): void {
    const ownerId = CloudSession.current()?.profile.id;
    if (!ownerId) return;
    const queue = MatchResultSync.store[ownerId] || [];
    MatchResultSync.store = {
      ...MatchResultSync.store,
      [ownerId]: enqueueResult(queue, { ...job, ownerId }),
    };
    MatchResultSync.save();
    MatchResultSync.schedule(0, ownerId);
  }

  static watch(operationId: string, listener: Listener): void {
    const ownerId = CloudSession.current()?.profile.id;
    if (!ownerId) return;
    MatchResultSync.listeners.set(`${ownerId}:${operationId}`, listener);
  }

  static noteSceneClosed(): void {
    const ownerId = CloudSession.current()?.profile.id;
    if (!ownerId || !MatchResultSync.store[ownerId]) return;
    MatchResultSync.store = {
      ...MatchResultSync.store,
      [ownerId]: markSceneClosed(MatchResultSync.store[ownerId]),
    };
    MatchResultSync.listeners = new Map(
      releaseOwnerListeners([...MatchResultSync.listeners.keys()], ownerId)
        .map((key) => [key, MatchResultSync.listeners.get(key)!]),
    );
    MatchResultSync.save();
    MatchResultSync.schedule(0, ownerId);
  }

  static pendingNotice(): string | null {
    const ownerId = CloudSession.current()?.profile.id;
    const own = ownerId ? statusNotice(MatchResultSync.store[ownerId] || []) : null;
    const legacy = MatchResultSync.store.__legacy?.length ? LEGACY_NOTICE : null;
    return [own, legacy].filter(Boolean).join("\n") || null;
  }

  static resume(): void {
    const loaded = MatchResultSync.read();
    if (loaded) MatchResultSync.store = mergeStores(MatchResultSync.store, loaded);
    const ownerId = CloudSession.current()?.profile.id;
    if (ownerId && selectForSend(MatchResultSync.store[ownerId] || [], ownerId)) MatchResultSync.schedule(0, ownerId);
  }

  private static schedule(delay: number, ownerId: string | null = null, retry = false): void {
    const decision = requestPump(
      { pumping: MatchResultSync.pumping, pending: MatchResultSync.pendingPumps },
      { delay, ownerId, retry },
    );
    MatchResultSync.pendingPumps = decision.pending;
    if (!decision.start) return;
    if (MatchResultSync.timer !== undefined) window.clearTimeout(MatchResultSync.timer);
    MatchResultSync.timer = window.setTimeout(() => {
      MatchResultSync.timer = undefined;
      void MatchResultSync.pump();
    }, decision.start.delay);
  }

  private static async pump(): Promise<void> {
    if (MatchResultSync.pumping) return;
    const ownerId = CloudSession.current()?.profile.id || null;
    const queue = ownerId ? MatchResultSync.store[ownerId] || [] : [];
    const job = selectForSend(queue, ownerId);
    if (!ownerId || !job || job.ownerId !== ownerId) {
      MatchResultSync.pendingPumps = MatchResultSync.pendingPumps.filter((item) => item.ownerId !== ownerId);
      MatchResultSync.armPending();
      return;
    }
    MatchResultSync.pumping = true;
    try {
      if (CloudSession.current()?.profile.id !== job.ownerId) return;
      const response = job.kind === "disconnect"
        ? await MatchService.disconnect(job.matchId, job.operationId)
        : await MatchService.finish(
          job.matchId,
          job.result || { rawTimeMs: null, credits: 0, dnf: true },
          job.observedOpponent || { rawTimeMs: null, credits: 0, dnf: true },
          job.operationId,
        );
      if (CloudSession.current()?.profile.id !== job.ownerId) return;
      const applied = applyAttempt(MatchResultSync.store[job.ownerId] || [], job, response);
      MatchResultSync.replace(job.ownerId, applied.queue);
      if (applied.disposition === "confirmed" && response.value) {
        const listener = MatchResultSync.listeners.get(`${job.ownerId}:${job.operationId}`);
        MatchResultSync.listeners.delete(`${job.ownerId}:${job.operationId}`);
        listener?.(response.value);
        if (selectForSend(MatchResultSync.store[job.ownerId] || [], job.ownerId)) MatchResultSync.schedule(0, job.ownerId);
        return;
      }
      if (applied.disposition === "permanent") {
        MatchResultSync.listeners.delete(`${job.ownerId}:${job.operationId}`);
        if (selectForSend(MatchResultSync.store[job.ownerId] || [], job.ownerId)) MatchResultSync.schedule(0, job.ownerId);
        return;
      }
      const current = selectForSend(MatchResultSync.store[job.ownerId] || [], job.ownerId);
      if (!current) return;
      const opponentStillPresent = response.status === "conflict" && response.code === "MATCH_ACTIVE";
      MatchResultSync.schedule(retryDelay(current.failures, opponentStillPresent), job.ownerId, true);
    } finally {
      MatchResultSync.pumping = false;
      MatchResultSync.armPending();
    }
  }

  private static armPending(): void {
    const decision = finishPump({ pumping: false, pending: MatchResultSync.pendingPumps });
    MatchResultSync.pendingPumps = decision.pending;
    if (!decision.start) return;
    if (MatchResultSync.timer !== undefined) window.clearTimeout(MatchResultSync.timer);
    MatchResultSync.timer = window.setTimeout(() => {
      MatchResultSync.timer = undefined;
      void MatchResultSync.pump();
    }, decision.start.delay);
  }

  private static replace(ownerId: string, queue: StoredResultJob[]): void {
    MatchResultSync.store = { ...MatchResultSync.store, [ownerId]: queue };
    MatchResultSync.save();
  }

  private static load(): Store {
    return MatchResultSync.read() || {};
  }

  private static read(): Store | null {
    try {
      if (typeof sessionStorage === "undefined") return null;
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return migrateStore(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  private static save(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(MatchResultSync.store));
    } catch {
      // A fila em memória continua tentando nesta aba.
    }
  }
}
