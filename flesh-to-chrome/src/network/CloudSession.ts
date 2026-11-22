import { fromApiState, sameProgress, toApiState } from "./campaign-state";
import { allowedApiOrigin, takeTicket } from "./api-origin";
import type { SaveData } from "../systems/SaveState";

const SESSION_KEY = "flesh-to-chrome:session";

export interface PlayerProfile {
  id: string;
  name: string;
  email: string;
}

export interface PlayerSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  profile: PlayerProfile;
}

export interface RemoteCampaign {
  status: "present" | "none" | "unavailable";
  revision: number;
  save: SaveData | null;
}

export interface CampaignSaveResult {
  status: "saved" | "conflict" | "unavailable";
  revision: number;
}

export type CampaignSyncStatus = "idle" | "syncing" | "pending" | "conflict";

export interface CampaignSyncState {
  status: CampaignSyncStatus;
  pending: number;
  action?: "save" | "reset" | "restore";
  completedAction?: "save" | "reset" | "restore";
  restoredSave?: SaveData;
}

interface PendingCampaignOperation {
  operationId: string;
  action: "save" | "reset" | "restore";
  save: SaveData | null;
  expectedRevision: number | null;
  attempted: boolean;
  retryCount: number;
  conflicted: boolean;
}

interface SessionResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  profile: PlayerProfile;
}

let apiBase: string | null = null;
let publishedApi = "";
const campaignRevisions = new Map<string, number>();
const campaignQueues = new Map<string, PendingCampaignOperation[]>();
const syncingCampaigns = new Set<string>();
const blockedCampaigns = new Set<string>();
const scheduledCampaigns = new Set<string>();
const retryTimers = new Map<string, number>();
const syncStates = new Map<string, CampaignSyncState>();
const syncListeners = new Set<(state: CampaignSyncState) => void>();
let recoveryHooksReady = false;

export class CloudSession {
  static storedOwner(): string | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PlayerSession;
      return parsed.profile?.id || null;
    } catch {
      return null;
    }
  }
  static current(): PlayerSession | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PlayerSession;
      if (!parsed.accessToken || !parsed.profile?.id) return null;
      if (parsed.expiresAt && parsed.expiresAt <= Date.now()) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  static async api(): Promise<string | null> {
    if (apiBase) return apiBase;
    publishedApi = await readPublishedApi();
    const pageHost = window.location.hostname;
    const localPage = pageHost === "localhost" || pageHost === "127.0.0.1";
    const fromQuery = new URLSearchParams(window.location.search).get("api");
    if (localPage && fromQuery) {
      const allowed = allowedApiOrigin(fromQuery, publishedApi, pageHost);
      if (allowed) {
        apiBase = allowed;
        return apiBase;
      }
    }
    if (!publishedApi) return null;
    apiBase = allowedApiOrigin(publishedApi, publishedApi, pageHost);
    return apiBase || null;
  }

  static async completeLoginIfNeeded(): Promise<PlayerSession | null> {
    const currentUrl = new URL(window.location.href);
    const { ticket, href } = takeTicket(currentUrl.href);
    if (ticket) window.history.replaceState({}, "", href);
    if (!ticket) return CloudSession.current();
    const api = await CloudSession.api();
    if (!api) return null;
    const response = await fetch(`${api}/auth/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as SessionResponse;
    const session: PlayerSession = {
      accessToken: body.accessToken,
      refreshToken: body.refreshToken || "",
      expiresAt: Date.now() + (body.expiresIn || 3600) * 1000,
      profile: body.profile,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  static async login(): Promise<void> {
    const api = await CloudSession.api();
    if (!api) return;
    const returnTo = `${window.location.origin}${window.location.pathname}`;
    window.location.assign(`${api}/auth/google/start?return=${encodeURIComponent(returnTo)}`);
  }

  static async logout(): Promise<void> {
    const api = await CloudSession.api();
    const session = CloudSession.current();
    sessionStorage.removeItem(SESSION_KEY);
    if (session) {
      campaignRevisions.delete(session.profile.id);
      blockedCampaigns.delete(session.profile.id);
      scheduledCampaigns.delete(session.profile.id);
      CloudSession.clearRetry(session.profile.id);
    }
    if (!api || !session) return;
    await fetch(`${api}/auth/logout`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    }).catch(() => undefined);
  }

  static async me(): Promise<PlayerProfile | null> {
    const api = await CloudSession.api();
    const session = CloudSession.current();
    if (!api || !session) return null;
    const response = await fetch(`${api}/me`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    if (!response.ok) return null;
    const profile = (await response.json()) as PlayerProfile;
    if (!profile?.id) return null;
    session.profile = profile;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return profile;
  }

  static async loadCampaign(): Promise<RemoteCampaign> {
    const api = await CloudSession.api();
    const session = CloudSession.current();
    if (!api || !session) return { status: "unavailable", revision: 0, save: null };
    let response: Response;
    try {
      response = await fetch(`${api}/me/campaign`, {
        headers: { authorization: `Bearer ${session.accessToken}` },
      });
    } catch {
      return { status: "unavailable", revision: 0, save: null };
    }
    if (response.status === 404) {
      campaignRevisions.set(session.profile.id, 0);
      return { status: "none", revision: 0, save: null };
    }
    if (!response.ok) return { status: "unavailable", revision: 0, save: null };
    const body = (await response.json()) as { revision?: number; state?: Parameters<typeof fromApiState>[0] };
    if (!body.state || typeof body.revision !== "number") return { status: "unavailable", revision: 0, save: null };
    campaignRevisions.set(session.profile.id, body.revision);
    return { status: "present", revision: body.revision, save: fromApiState(body.state) };
  }

  static async saveCampaign(
    save: SaveData,
    revision: number,
    source: "online" | "guest-import" | "local-sync"
  ): Promise<CampaignSaveResult> {
    const api = await CloudSession.api();
    const session = CloudSession.current();
    if (!api || !session) return { status: "unavailable", revision };
    let response: Response;
    try {
      response = await fetch(`${api}/me/campaign`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${session.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          operationId: crypto.randomUUID(),
          expectedRevision: revision,
          schemaVersion: 1,
          source,
          state: toApiState(save),
        }),
      });
    } catch {
      return { status: "unavailable", revision };
    }
    if (response.status === 409) return { status: "conflict", revision };
    if (!response.ok) return { status: "unavailable", revision };
    const body = (await response.json().catch(() => ({}))) as { revision?: number };
    const nextRevision = typeof body.revision === "number" ? body.revision : revision + 1;
    campaignRevisions.set(session.profile.id, nextRevision);
    return { status: "saved", revision: nextRevision };
  }

  static resumeCampaignSync(userId: string, revision: number): void {
    campaignRevisions.set(userId, revision);
    const queue = CloudSession.queueFor(userId);
    if (queue.some((operation) => operation.conflicted)) blockedCampaigns.add(userId);
    else blockedCampaigns.delete(userId);
    CloudSession.ensureRecoveryHooks();
    CloudSession.scheduleCampaignSync(userId, true);
  }

  static pauseCampaignSync(userId: string): void {
    blockedCampaigns.add(userId);
  }

  static discardPendingCampaignSync(userId: string): void {
    campaignQueues.set(userId, []);
    blockedCampaigns.delete(userId);
    CloudSession.clearRetry(userId);
    CloudSession.persistQueue(userId);
    CloudSession.emitSync(userId, { status: "idle", pending: 0 });
  }

  static hasPendingCampaignSync(userId: string): boolean {
    return CloudSession.queueFor(userId).length > 0;
  }

  static hasCampaignConflict(userId: string): boolean {
    return CloudSession.queueFor(userId).some((operation) => operation.conflicted);
  }

  static campaignSyncState(): CampaignSyncState {
    const session = CloudSession.current();
    if (!session) return { status: "idle", pending: 0 };
    return syncStates.get(session.profile.id) || CloudSession.stateFor(session.profile.id);
  }

  static subscribeCampaignSync(listener: (state: CampaignSyncState) => void): () => void {
    syncListeners.add(listener);
    listener(CloudSession.campaignSyncState());
    return () => syncListeners.delete(listener);
  }

  static queueCampaignSync(save: SaveData): void {
    const session = CloudSession.current();
    if (!session) return;
    CloudSession.enqueue(session.profile.id, "save", save);
  }

  static queueCampaignReset(_save: SaveData): void {
    const session = CloudSession.current();
    if (!session) return;
    CloudSession.enqueue(session.profile.id, "reset", null);
  }

  static queueGateRestore(): boolean {
    const session = CloudSession.current();
    if (!session) return false;
    const queue = CloudSession.queueFor(session.profile.id);
    if (!queue.some((operation) => operation.action === "restore")) {
      CloudSession.enqueue(session.profile.id, "restore", null);
    } else {
      CloudSession.scheduleCampaignSync(session.profile.id, true);
    }
    return true;
  }

  static retryCampaignSync(): void {
    const session = CloudSession.current();
    if (!session || CloudSession.hasCampaignConflict(session.profile.id)) return;
    CloudSession.clearRetry(session.profile.id);
    blockedCampaigns.delete(session.profile.id);
    CloudSession.scheduleCampaignSync(session.profile.id, true);
  }

  private static enqueue(
    userId: string,
    action: PendingCampaignOperation["action"],
    save: SaveData | null
  ): void {
    const queue = CloudSession.queueFor(userId);
    const tail = queue.at(-1);
    const copy = save ? JSON.parse(JSON.stringify(save)) as SaveData : null;
    if (action === "save" && tail?.action === "save" && !tail.attempted && !tail.conflicted) {
      tail.save = copy;
    } else {
      queue.push({
        operationId: crypto.randomUUID(),
        action,
        save: copy,
        expectedRevision: null,
        attempted: false,
        retryCount: 0,
        conflicted: false,
      });
    }
    CloudSession.persistQueue(userId);
    CloudSession.emitSync(userId, { status: "pending", pending: queue.length, action: queue[0]?.action });
    CloudSession.ensureRecoveryHooks();
    CloudSession.scheduleCampaignSync(userId);
  }

  private static scheduleCampaignSync(userId: string, force = false): void {
    if (!force && retryTimers.has(userId)) return;
    if (scheduledCampaigns.has(userId)) return;
    scheduledCampaigns.add(userId);
    queueMicrotask(() => {
      scheduledCampaigns.delete(userId);
      void CloudSession.flushCampaignSync(userId);
    });
  }

  private static async flushCampaignSync(userId: string): Promise<void> {
    if (syncingCampaigns.has(userId) || blockedCampaigns.has(userId)) return;
    syncingCampaigns.add(userId);
    try {
      const queue = CloudSession.queueFor(userId);
      while (queue.length > 0 && !blockedCampaigns.has(userId)) {
        const session = CloudSession.current();
        if (!session || session.profile.id !== userId) return;
        const operation = queue[0];
        if (operation.conflicted) {
          blockedCampaigns.add(userId);
          CloudSession.emitSync(userId, { status: "conflict", pending: queue.length, action: operation.action });
          return;
        }
        if (operation.expectedRevision === null) {
          let revision = campaignRevisions.get(userId);
          if (revision === undefined) {
            const remote = await CloudSession.loadCampaign();
            if (remote.status === "unavailable") {
              CloudSession.deferOperation(userId, operation);
              return;
            }
            revision = remote.revision;
          }
          operation.expectedRevision = revision;
        }
        operation.attempted = true;
        CloudSession.persistQueue(userId);
        CloudSession.emitSync(userId, { status: "syncing", pending: queue.length, action: operation.action });
        const result = await CloudSession.executeQueuedOperation(operation);
        if (result.status === "saved") {
          campaignRevisions.set(userId, result.revision);
          queue.shift();
          CloudSession.clearRetry(userId);
          CloudSession.persistQueue(userId);
          CloudSession.emitSync(userId, {
            status: queue.length ? "pending" : "idle",
            pending: queue.length,
            action: queue[0]?.action,
            completedAction: operation.action,
            restoredSave: result.save,
          });
          continue;
        }
        if (result.status === "conflict") {
          operation.conflicted = true;
          blockedCampaigns.add(userId);
          CloudSession.persistQueue(userId);
          CloudSession.emitSync(userId, { status: "conflict", pending: queue.length, action: operation.action });
          return;
        }
        CloudSession.deferOperation(userId, operation);
        return;
      }
    } finally {
      syncingCampaigns.delete(userId);
    }
  }

  private static async executeQueuedOperation(
    operation: PendingCampaignOperation
  ): Promise<CampaignSaveResult & { save?: SaveData }> {
    const api = await CloudSession.api();
    const session = CloudSession.current();
    const revision = operation.expectedRevision ?? 0;
    if (!api || !session) return { status: "unavailable", revision };
    const path = operation.action === "reset"
      ? "/me/campaign/reset"
      : operation.action === "restore"
        ? "/me/campaign/restore-gate"
        : "/me/campaign";
    const body = operation.action === "save"
      ? {
          operationId: operation.operationId,
          expectedRevision: revision,
          schemaVersion: 1,
          source: "online",
          state: toApiState(operation.save!),
        }
      : {
          operationId: operation.operationId,
          expectedRevision: revision,
          ...(operation.action === "reset" ? { confirmed: true } : {}),
        };
    let response: Response;
    try {
      response = await fetch(`${api}${path}`, {
        method: operation.action === "save" ? "PUT" : "POST",
        headers: {
          authorization: `Bearer ${session.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      return { status: "unavailable", revision };
    }
    if (response.status === 409) return { status: "conflict", revision };
    if (!response.ok) return { status: "unavailable", revision };
    const responseBody = (await response.json().catch(() => ({}))) as {
      revision?: number;
      state?: Parameters<typeof fromApiState>[0];
    };
    if (operation.action === "restore" && !responseBody.state) {
      return { status: "unavailable", revision };
    }
    const nextRevision = typeof responseBody.revision === "number" ? responseBody.revision : revision + 1;
    return {
      status: "saved",
      revision: nextRevision,
      save: operation.action === "restore" && responseBody.state
        ? fromApiState(responseBody.state)
        : undefined,
    };
  }

  private static queueFor(userId: string): PendingCampaignOperation[] {
    const cached = campaignQueues.get(userId);
    if (cached) return cached;
    let queue: PendingCampaignOperation[] = [];
    try {
      const raw = localStorage.getItem(CloudSession.queueKey(userId));
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        queue = parsed
          .filter((operation) => (
            operation &&
            typeof operation.operationId === "string" &&
            ["save", "reset", "restore"].includes(operation.action) &&
            (operation.expectedRevision === null || typeof operation.expectedRevision === "number")
          ))
          .map((operation) => ({
            operationId: operation.operationId,
            action: operation.action,
            save: operation.save || null,
            expectedRevision: operation.expectedRevision,
            attempted: Boolean(operation.attempted),
            retryCount: Number.isFinite(operation.retryCount) ? operation.retryCount : 0,
            conflicted: Boolean(operation.conflicted),
          }));
      }
    } catch {
      queue = [];
    }
    campaignQueues.set(userId, queue);
    return queue;
  }

  private static queueKey(userId: string): string {
    return `flesh-to-chrome:campaign-sync:${userId}`;
  }

  private static persistQueue(userId: string): void {
    const queue = campaignQueues.get(userId) || [];
    try {
      if (queue.length) localStorage.setItem(CloudSession.queueKey(userId), JSON.stringify(queue));
      else localStorage.removeItem(CloudSession.queueKey(userId));
    } catch {
      // O save da conta continua sendo a cópia de recuperação se a fila não puder ser persistida.
    }
  }

  private static deferOperation(userId: string, operation: PendingCampaignOperation): void {
    operation.retryCount += 1;
    CloudSession.persistQueue(userId);
    const queue = CloudSession.queueFor(userId);
    CloudSession.emitSync(userId, { status: "pending", pending: queue.length, action: operation.action });
    CloudSession.clearRetry(userId);
    const delay = Math.min(1000 * 2 ** Math.max(0, operation.retryCount - 1), 30000);
    const timer = window.setTimeout(() => {
      retryTimers.delete(userId);
      CloudSession.scheduleCampaignSync(userId, true);
    }, delay);
    retryTimers.set(userId, timer);
  }

  private static clearRetry(userId: string): void {
    const timer = retryTimers.get(userId);
    if (timer !== undefined) window.clearTimeout(timer);
    retryTimers.delete(userId);
  }

  private static stateFor(userId: string): CampaignSyncState {
    const queue = CloudSession.queueFor(userId);
    if (!queue.length) return { status: "idle", pending: 0 };
    if (queue.some((operation) => operation.conflicted)) {
      return { status: "conflict", pending: queue.length, action: queue[0]?.action };
    }
    return { status: "pending", pending: queue.length, action: queue[0]?.action };
  }

  private static emitSync(userId: string, state: CampaignSyncState): void {
    const currentState = { ...state };
    delete currentState.completedAction;
    delete currentState.restoredSave;
    syncStates.set(userId, currentState);
    const session = CloudSession.current();
    if (!session || session.profile.id !== userId) return;
    syncListeners.forEach((listener) => listener(state));
  }

  private static ensureRecoveryHooks(): void {
    if (recoveryHooksReady) return;
    recoveryHooksReady = true;
    window.addEventListener("online", () => {
      const session = CloudSession.current();
      if (!session || CloudSession.hasCampaignConflict(session.profile.id)) return;
      CloudSession.clearRetry(session.profile.id);
      blockedCampaigns.delete(session.profile.id);
      CloudSession.scheduleCampaignSync(session.profile.id, true);
    });
  }

  static same(left: SaveData, right: SaveData): boolean {
    return sameProgress(left, right);
  }
}

async function readPublishedApi(): Promise<string> {
  try {
    const response = await fetch("/cloud-config.json", { cache: "no-store" });
    if (!response.ok) return "";
    const body = (await response.json()) as { api?: string };
    return body.api || "";
  } catch {
    return "";
  }
}
