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

export interface LogoutResult {
  localLogout: "completed";
  refreshTokenRevocation: "confirmed" | "rejected" | "unavailable" | "not-requested";
}

interface PendingCampaignOperation {
  ownerId: string;
  operationId: string;
  action: "save" | "reset" | "restore";
  save: SaveData | null;
  expectedRevision: number | null;
  attempted: boolean;
  retryCount: number;
  conflicted: boolean;
}

type QueuedOperationResult = (CampaignSaveResult & { save?: SaveData }) | {
  status: "owner-changed";
  revision: number;
};

interface SessionResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  profile: PlayerProfile;
}

let apiBase: string | null = null;
let publishedApi = "";
let publishedSignaling = "";
let publishedIceServers: Array<{ urls: string }> = [];
let cloudConfigRequest: Promise<{ api: string; signaling: string; iceServers: Array<{ urls: string }> }> | null = null;
const campaignRevisions = new Map<string, number>();
const campaignQueues = new Map<string, PendingCampaignOperation[]>();
const syncingCampaigns = new Set<string>();
const blockedCampaigns = new Set<string>();
const scheduledCampaigns = new Set<string>();
const retryTimers = new Map<string, number>();
const syncStates = new Map<string, CampaignSyncState>();
const syncListeners = new Set<(state: CampaignSyncState) => void>();
const activeRequests = new Map<string, Set<AbortController>>();
let recoveryHooksReady = false;

export class CloudSession {
  static stored(): PlayerSession | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PlayerSession;
      if (!parsed.profile?.id || (!parsed.accessToken && !parsed.refreshToken)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  static storedOwner(): string | null {
    return CloudSession.stored()?.profile.id || null;
  }

  static current(): PlayerSession | null {
    const stored = CloudSession.stored();
    if (!stored?.accessToken) return null;
    if (stored.expiresAt && stored.expiresAt <= Date.now()) return null;
    return stored;
  }

  static async api(): Promise<string | null> {
    if (apiBase) return apiBase;
    const config = await readPublishedConfig();
    publishedApi = config.api;
    publishedSignaling = config.signaling;
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

  static async signaling(): Promise<string | null> {
    if (!publishedSignaling) {
      const config = await readPublishedConfig();
      publishedApi ||= config.api;
      publishedSignaling = config.signaling;
    }
    if (!publishedSignaling) return null;
    try {
      const url = new URL(publishedSignaling);
      const localPage = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const localSignal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      if (url.username || url.password) return null;
      if (url.protocol === "wss:") return url.toString();
      if (localPage && localSignal && url.protocol === "ws:") return url.toString();
      return null;
    } catch {
      return null;
    }
  }

  static async iceServers(): Promise<Array<{ urls: string }>> {
    await readPublishedConfig();
    return publishedIceServers;
  }

  static async completeLoginIfNeeded(): Promise<PlayerSession | null> {
    const previousSession = CloudSession.current();
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
    const currentSession = CloudSession.current();
    if (currentSession && currentSession.accessToken !== previousSession?.accessToken) return currentSession;
    if (previousSession && previousSession.profile.id !== session.profile.id) {
      CloudSession.abortOwnerRequests(previousSession.profile.id);
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  static async login(): Promise<void> {
    const api = await CloudSession.api();
    if (!api) return;
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.delete("ticket");
    const returnTo = `${returnUrl.origin}${returnUrl.pathname}${returnUrl.search}`;
    window.location.assign(`${api}/auth/google/start?return=${encodeURIComponent(returnTo)}`);
  }

  static async logout(): Promise<LogoutResult> {
    const session = CloudSession.stored();
    sessionStorage.removeItem(SESSION_KEY);
    if (!session) return { localLogout: "completed", refreshTokenRevocation: "not-requested" };
    CloudSession.abortOwnerRequests(session.profile.id);
    campaignRevisions.delete(session.profile.id);
    blockedCampaigns.delete(session.profile.id);
    scheduledCampaigns.delete(session.profile.id);
    CloudSession.clearRetry(session.profile.id);
    if (!session.refreshToken) {
      return { localLogout: "completed", refreshTokenRevocation: "not-requested" };
    }
    const api = await CloudSession.api();
    if (!api) {
      console.warn("Refresh token revocation could not be requested.", { reason: "api-unavailable" });
      return { localLogout: "completed", refreshTokenRevocation: "unavailable" };
    }
    try {
      const response = await fetch(`${api}/auth/logout`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
      if (response.ok) {
        return { localLogout: "completed", refreshTokenRevocation: "confirmed" };
      }
      let code = "HTTP_ERROR";
      try {
        const body = (await response.json()) as { error?: { code?: string } };
        if (body.error?.code) code = body.error.code;
      } catch {
        // A classificação pelo status HTTP continua disponível mesmo sem corpo JSON.
      }
      const refreshTokenRevocation = code === "TOKEN_REVOCATION_REJECTED"
        ? "rejected"
        : "unavailable";
      console.warn("Refresh token revocation was not confirmed.", {
        status: response.status,
        code,
      });
      return { localLogout: "completed", refreshTokenRevocation };
    } catch (error) {
      const errorName = typeof (error as { name?: unknown })?.name === "string"
        ? (error as { name: string }).name
        : "Error";
      console.warn("Refresh token revocation was not confirmed.", {
        reason: "network-error",
        errorName,
      });
      return { localLogout: "completed", refreshTokenRevocation: "unavailable" };
    }
  }

  static async me(): Promise<PlayerProfile | null> {
    const session = CloudSession.current();
    if (!session) return null;
    const api = await CloudSession.api();
    if (!api || !CloudSession.sameOwnerSession(session)) return null;
    const controller = CloudSession.trackOwnerRequest(session.profile.id);
    let response: Response;
    try {
      response = await fetch(`${api}/me`, {
        headers: { authorization: `Bearer ${session.accessToken}` },
        signal: controller.signal,
      });
    } catch {
      return null;
    } finally {
      CloudSession.releaseOwnerRequest(session.profile.id, controller);
    }
    if (!response.ok) return null;
    const profile = (await response.json()) as PlayerProfile;
    if (!profile?.id || !CloudSession.sameOwnerSession(session)) return null;
    session.profile = profile;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return profile;
  }

  static async loadCampaign(): Promise<RemoteCampaign> {
    const session = CloudSession.current();
    if (!session) return { status: "unavailable", revision: 0, save: null };
    const api = await CloudSession.api();
    if (!api || !CloudSession.sameOwnerSession(session)) {
      return { status: "unavailable", revision: 0, save: null };
    }
    const controller = CloudSession.trackOwnerRequest(session.profile.id);
    let response: Response;
    try {
      response = await fetch(`${api}/me/campaign`, {
        headers: { authorization: `Bearer ${session.accessToken}` },
        signal: controller.signal,
      });
    } catch {
      return { status: "unavailable", revision: 0, save: null };
    } finally {
      CloudSession.releaseOwnerRequest(session.profile.id, controller);
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
    const session = CloudSession.current();
    if (!session) return { status: "unavailable", revision };
    const api = await CloudSession.api();
    if (!api || !CloudSession.sameOwnerSession(session)) return { status: "unavailable", revision };
    const controller = CloudSession.trackOwnerRequest(session.profile.id);
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
        signal: controller.signal,
      });
    } catch {
      return { status: "unavailable", revision };
    } finally {
      CloudSession.releaseOwnerRequest(session.profile.id, controller);
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
        ownerId: userId,
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
              if (!CloudSession.isCurrentOwner(userId)) {
                CloudSession.persistQueue(userId);
                return;
              }
              CloudSession.deferOperation(userId, operation);
              return;
            }
            if (!CloudSession.isCurrentOwner(userId)) return;
            revision = remote.revision;
          }
          operation.expectedRevision = revision;
        }
        operation.attempted = true;
        CloudSession.persistQueue(userId);
        CloudSession.emitSync(userId, { status: "syncing", pending: queue.length, action: operation.action });
        const result = await CloudSession.executeQueuedOperation(userId, operation);
        if (result.status === "owner-changed") {
          CloudSession.persistQueue(userId);
          return;
        }
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
    userId: string,
    operation: PendingCampaignOperation
  ): Promise<QueuedOperationResult> {
    const api = await CloudSession.api();
    const session = CloudSession.current();
    const revision = operation.expectedRevision ?? 0;
    if (
      !api ||
      !session ||
      operation.ownerId !== userId ||
      session.profile.id !== operation.ownerId
    ) {
      return { status: "owner-changed", revision };
    }
    const accessToken = session.accessToken;
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
    const controller = CloudSession.trackOwnerRequest(operation.ownerId);
    try {
      if (!CloudSession.isCurrentOwner(operation.ownerId, accessToken)) {
        return { status: "owner-changed", revision };
      }
      response = await fetch(`${api}${path}`, {
        method: operation.action === "save" ? "PUT" : "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      if (!CloudSession.isCurrentOwner(operation.ownerId, accessToken) || controller.signal.aborted) {
        return { status: "owner-changed", revision };
      }
      return { status: "unavailable", revision };
    } finally {
      CloudSession.releaseOwnerRequest(operation.ownerId, controller);
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
            (operation.ownerId === undefined || operation.ownerId === userId) &&
            typeof operation.operationId === "string" &&
            ["save", "reset", "restore"].includes(operation.action) &&
            (operation.expectedRevision === null || typeof operation.expectedRevision === "number")
          ))
          .map((operation) => ({
            ownerId: userId,
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

  private static isCurrentOwner(userId: string, accessToken?: string): boolean {
    const session = CloudSession.current();
    return Boolean(
      session &&
      session.profile.id === userId &&
      (accessToken === undefined || session.accessToken === accessToken)
    );
  }

  private static sameOwnerSession(expected: PlayerSession): boolean {
    return CloudSession.isCurrentOwner(expected.profile.id, expected.accessToken);
  }

  private static trackOwnerRequest(userId: string): AbortController {
    const controller = new AbortController();
    const requests = activeRequests.get(userId) || new Set<AbortController>();
    requests.add(controller);
    activeRequests.set(userId, requests);
    return controller;
  }

  private static releaseOwnerRequest(userId: string, controller: AbortController): void {
    const requests = activeRequests.get(userId);
    requests?.delete(controller);
    if (!requests?.size) activeRequests.delete(userId);
  }

  private static abortOwnerRequests(userId: string): void {
    activeRequests.get(userId)?.forEach((controller) => controller.abort());
    activeRequests.delete(userId);
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

async function readPublishedConfig(): Promise<{ api: string; signaling: string; iceServers: Array<{ urls: string }> }> {
  if (cloudConfigRequest) return cloudConfigRequest;
  cloudConfigRequest = (async () => {
    try {
      const response = await fetch("/cloud-config.json", { cache: "no-store" });
      if (!response.ok) return { api: "", signaling: "", iceServers: [] };
      const body = (await response.json()) as { api?: string; signaling?: string; iceServers?: unknown };
      const iceServers = publicStunServers(body.iceServers);
      publishedIceServers = iceServers;
      return { api: body.api || "", signaling: body.signaling || "", iceServers };
    } catch {
      return { api: "", signaling: "", iceServers: [] };
    }
  })();
  return cloudConfigRequest;
}

function publicStunServers(value: unknown): Array<{ urls: string }> {
  if (!Array.isArray(value)) return [];
  const servers: Array<{ urls: string }> = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const urls = (item as { urls?: unknown }).urls;
    const list = Array.isArray(urls) ? urls : [urls];
    const stun = list.find((url): url is string => typeof url === "string" && url.startsWith("stun:"));
    if (stun) servers.push({ urls: stun });
  }
  return servers;
}
