import { CloudSession } from "./CloudSession";
import { MatchParticipantResult, MatchService, RemoteMatch } from "./MatchService";
import {
  StoredResultJob,
  attemptDisposition,
  enqueueResult,
  markConfirmed,
  markFailure,
  markRejected,
  markSceneClosed,
  pendingNotice,
  retryDelay,
  selectForSend,
} from "./match-result-sync";

const STORAGE_KEY = "flesh-to-chrome:match-result:v1";

type Listener = (match: RemoteMatch) => void;
type Store = Record<string, StoredResultJob[]>;

export class MatchResultSync {
  private static store: Store = MatchResultSync.read();
  private static listeners = new Map<string, Listener>();
  private static timer: number | undefined;
  private static pumping = false;

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
    MatchResultSync.schedule(0);
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
    MatchResultSync.save();
    MatchResultSync.schedule(0);
  }

  static pendingNotice(): string | null {
    const ownerId = CloudSession.current()?.profile.id;
    if (!ownerId) return null;
    return pendingNotice(MatchResultSync.store[ownerId] || []);
  }

  static resume(): void {
    MatchResultSync.store = MatchResultSync.read();
    const ownerId = CloudSession.current()?.profile.id;
    if (ownerId && selectForSend(MatchResultSync.store[ownerId] || [], ownerId)) MatchResultSync.schedule(0);
  }

  private static schedule(delay: number): void {
    if (MatchResultSync.timer !== undefined) return;
    MatchResultSync.timer = window.setTimeout(() => {
      MatchResultSync.timer = undefined;
      void MatchResultSync.pump();
    }, delay);
  }

  private static async pump(): Promise<void> {
    if (MatchResultSync.pumping) return;
    const ownerId = CloudSession.current()?.profile.id || null;
    const queue = ownerId ? MatchResultSync.store[ownerId] || [] : [];
    const job = selectForSend(queue, ownerId);
    if (!ownerId || !job || job.ownerId !== ownerId) return;
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
      const disposition = attemptDisposition(response.status);
      const stored = disposition === "confirmed" && response.value
        && (job.kind === "finish" || response.value.state === "finished");
      if (stored && response.value) {
        const listener = MatchResultSync.listeners.get(`${job.ownerId}:${job.operationId}`);
        MatchResultSync.replace(job.ownerId, markConfirmed(MatchResultSync.store[job.ownerId] || [], job.operationId, job.ownerId));
        MatchResultSync.listeners.delete(`${job.ownerId}:${job.operationId}`);
        listener?.(response.value);
        if (selectForSend(MatchResultSync.store[job.ownerId] || [], job.ownerId)) MatchResultSync.schedule(0);
        return;
      }
      if (disposition === "permanent") {
        MatchResultSync.replace(
          job.ownerId,
          markRejected(MatchResultSync.store[job.ownerId] || [], job.operationId, job.ownerId, response.code || "invalid"),
        );
        MatchResultSync.listeners.delete(`${job.ownerId}:${job.operationId}`);
        if (selectForSend(MatchResultSync.store[job.ownerId] || [], job.ownerId)) MatchResultSync.schedule(0);
        return;
      }
      MatchResultSync.replace(
        job.ownerId,
        markFailure(MatchResultSync.store[job.ownerId] || [], job.operationId, job.ownerId),
      );
      const current = selectForSend(MatchResultSync.store[job.ownerId] || [], job.ownerId);
      if (!current) return;
      const opponentStillPresent = response.status === "conflict" && response.code === "MATCH_ACTIVE";
      MatchResultSync.schedule(retryDelay(current.failures, opponentStillPresent));
    } finally {
      MatchResultSync.pumping = false;
    }
  }

  private static replace(ownerId: string, queue: StoredResultJob[]): void {
    MatchResultSync.store = { ...MatchResultSync.store, [ownerId]: queue };
    MatchResultSync.save();
  }

  private static read(): Store {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Store | StoredResultJob[];
      if (Array.isArray(parsed)) return {};
      if (!parsed || typeof parsed !== "object") return {};
      return parsed;
    } catch {
      return {};
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
