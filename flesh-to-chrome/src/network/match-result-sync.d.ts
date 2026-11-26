export interface StoredResultJob {
  kind: "disconnect" | "finish";
  matchId: string;
  operationId: string;
  ownerId: string;
  result: { rawTimeMs: number | null; credits: number; dnf: boolean } | null;
  observedOpponent: { rawTimeMs: number | null; credits: number; dnf: boolean } | null;
  failures: number;
  sceneClosed: boolean;
  status: "pending" | "rejected";
  notice: string;
  rejectedReason: string | null;
}

export function enqueueResult(
  queue: StoredResultJob[],
  job: Partial<StoredResultJob> & Pick<StoredResultJob, "kind" | "matchId" | "operationId" | "ownerId">,
): StoredResultJob[];
export function markSceneClosed(queue: StoredResultJob[]): StoredResultJob[];
export function markFailure(queue: StoredResultJob[], operationId: string, ownerId: string): StoredResultJob[];
export function markRejected(queue: StoredResultJob[], operationId: string, ownerId: string, reason: string): StoredResultJob[];
export function markConfirmed(queue: StoredResultJob[], operationId: string, ownerId: string): StoredResultJob[];
export function pendingNotice(queue: StoredResultJob[]): string | null;
export function selectForSend(queue: StoredResultJob[], activeOwnerId: string | null): StoredResultJob | null;
export function retryDelay(failures: number, opponentStillPresent: boolean): number;
export function attemptDisposition(status: string): "confirmed" | "permanent" | "temporary";
