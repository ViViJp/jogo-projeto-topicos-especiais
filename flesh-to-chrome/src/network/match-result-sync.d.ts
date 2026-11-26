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

export interface PumpRequest {
  ownerId?: string | null;
  delay: number;
  retry?: boolean;
}

export interface PumpGate {
  pumping: boolean;
  pending: PumpRequest[];
}

export interface AttemptResponse {
  status: string;
  code?: string | null;
  state?: string | null;
  value?: { state?: string | null };
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
export function statusNotice(queue: StoredResultJob[]): string | null;
export function selectForSend(queue: StoredResultJob[], activeOwnerId: string | null): StoredResultJob | null;
export function retryDelay(failures: number, opponentStillPresent: boolean): number;
export function attemptDisposition(response: string | AttemptResponse, kind?: StoredResultJob["kind"]): "confirmed" | "permanent" | "temporary";
export function applyAttempt(queue: StoredResultJob[], job: StoredResultJob, response: AttemptResponse): { disposition: "confirmed" | "permanent" | "temporary"; queue: StoredResultJob[] };
export function requestPump(gate: PumpGate, request: PumpRequest): PumpGate & { start: PumpRequest | null };
export function finishPump(gate: PumpGate): PumpGate & { start: PumpRequest | null };
export function releaseOwnerListeners(keys: string[], ownerId: string): string[];
export function migrateStore(parsed: unknown): Record<string, StoredResultJob[]>;
export function mergeStores(memory: Record<string, StoredResultJob[]>, stored: Record<string, StoredResultJob[]>): Record<string, StoredResultJob[]>;
export const LEGACY_NOTICE: string;
