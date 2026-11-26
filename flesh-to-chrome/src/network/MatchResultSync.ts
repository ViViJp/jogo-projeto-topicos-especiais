import { MatchParticipantResult, MatchService, RemoteMatch } from "./MatchService";
import {
  StoredResultJob,
  enqueueResult,
  markConfirmed,
  markFailure,
  markSceneClosed,
  pendingNotice,
  retryDelay,
} from "./match-result-sync";

const STORAGE_KEY = "flesh-to-chrome:match-result:v1";

type Listener = (match: RemoteMatch) => void;

export class MatchResultSync {
  private static jobs: StoredResultJob[] = MatchResultSync.read();
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
    MatchResultSync.jobs = enqueueResult(MatchResultSync.jobs, job);
    MatchResultSync.save();
    MatchResultSync.schedule(0);
  }

  static watch(operationId: string, listener: Listener): void {
    MatchResultSync.listeners.set(operationId, listener);
  }

  static noteSceneClosed(): void {
    MatchResultSync.jobs = markSceneClosed(MatchResultSync.jobs);
    MatchResultSync.save();
    MatchResultSync.schedule(0);
  }

  static pendingNotice(): string | null {
    return pendingNotice(MatchResultSync.jobs);
  }

  static resume(): void {
    MatchResultSync.jobs = MatchResultSync.read();
    if (MatchResultSync.jobs.length) MatchResultSync.schedule(0);
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
    const job = MatchResultSync.jobs[0];
    if (!job) return;
    MatchResultSync.pumping = true;
    try {
      const response = job.kind === "disconnect"
        ? await MatchService.disconnect(job.matchId, job.operationId)
        : await MatchService.finish(
          job.matchId,
          job.result || { rawTimeMs: null, credits: 0, dnf: true },
          job.observedOpponent || { rawTimeMs: null, credits: 0, dnf: true },
          job.operationId,
        );
      const stored = response.status === "ok" && response.value
        && (job.kind === "finish" || response.value.state === "finished");
      if (stored && response.value) {
        const listener = MatchResultSync.listeners.get(job.operationId);
        MatchResultSync.jobs = markConfirmed(MatchResultSync.jobs, job.operationId);
        MatchResultSync.listeners.delete(job.operationId);
        MatchResultSync.save();
        listener?.(response.value);
        if (MatchResultSync.jobs.length) MatchResultSync.schedule(0);
        return;
      }
      MatchResultSync.jobs = markFailure(MatchResultSync.jobs, job.operationId);
      MatchResultSync.save();
      const current = MatchResultSync.jobs[0];
      if (!current) return;
      const opponentStillPresent = response.status === "conflict" && response.code === "MATCH_ACTIVE";
      MatchResultSync.schedule(retryDelay(current.failures, opponentStillPresent));
    } finally {
      MatchResultSync.pumping = false;
      if (MatchResultSync.jobs.length && MatchResultSync.timer === undefined) {
        MatchResultSync.schedule(0);
      }
    }
  }

  private static read(): StoredResultJob[] {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) as StoredResultJob[] : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private static save(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(MatchResultSync.jobs));
    } catch {
      // A fila em memória continua tentando nesta aba.
    }
  }
}
