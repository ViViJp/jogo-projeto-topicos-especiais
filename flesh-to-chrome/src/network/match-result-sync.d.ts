export interface StoredResultJob {
  kind: "disconnect" | "finish";
  matchId: string;
  operationId: string;
  result: { rawTimeMs: number | null; credits: number; dnf: boolean } | null;
  observedOpponent: { rawTimeMs: number | null; credits: number; dnf: boolean } | null;
  failures: number;
  sceneClosed: boolean;
  notice: string;
}

export function enqueueResult(queue: StoredResultJob[], job: Partial<StoredResultJob> & Pick<StoredResultJob, "kind" | "matchId" | "operationId">): StoredResultJob[];
export function markSceneClosed(queue: StoredResultJob[]): StoredResultJob[];
export function markFailure(queue: StoredResultJob[], operationId: string): StoredResultJob[];
export function markConfirmed(queue: StoredResultJob[], operationId: string): StoredResultJob[];
export function pendingNotice(queue: StoredResultJob[]): string | null;
export function retryDelay(failures: number, opponentStillPresent: boolean): number;
