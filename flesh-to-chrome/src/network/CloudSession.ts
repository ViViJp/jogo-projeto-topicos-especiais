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

interface SessionResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  profile: PlayerProfile;
}

let apiBase: string | null = null;
let publishedApi = "";
const campaignRevisions = new Map<string, number>();
const queuedCampaigns = new Map<string, { save: SaveData; action: "save" | "reset" }>();
const syncingCampaigns = new Set<string>();
const blockedCampaigns = new Set<string>();
const scheduledCampaigns = new Set<string>();

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
      queuedCampaigns.delete(session.profile.id);
      blockedCampaigns.delete(session.profile.id);
      scheduledCampaigns.delete(session.profile.id);
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
    queuedCampaigns.delete(userId);
    blockedCampaigns.delete(userId);
    CloudSession.scheduleCampaignSync(userId);
  }

  static pauseCampaignSync(userId: string): void {
    blockedCampaigns.add(userId);
  }

  static queueCampaignSync(save: SaveData): void {
    const session = CloudSession.current();
    if (!session || !campaignRevisions.has(session.profile.id)) return;
    queuedCampaigns.set(session.profile.id, {
      save: JSON.parse(JSON.stringify(save)) as SaveData,
      action: "save",
    });
    CloudSession.scheduleCampaignSync(session.profile.id);
  }

  static queueCampaignReset(save: SaveData): void {
    const session = CloudSession.current();
    if (!session || !campaignRevisions.has(session.profile.id)) return;
    queuedCampaigns.set(session.profile.id, {
      save: JSON.parse(JSON.stringify(save)) as SaveData,
      action: "reset",
    });
    CloudSession.scheduleCampaignSync(session.profile.id);
  }

  private static scheduleCampaignSync(userId: string): void {
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
      while (queuedCampaigns.has(userId) && !blockedCampaigns.has(userId)) {
        const session = CloudSession.current();
        const revision = campaignRevisions.get(userId);
        if (!session || session.profile.id !== userId || revision === undefined) return;
        const queued = queuedCampaigns.get(userId)!;
        queuedCampaigns.delete(userId);
        const result = queued.action === "reset"
          ? await CloudSession.resetCampaign(revision)
          : await CloudSession.saveCampaign(queued.save, revision, "online");
        if (result.status === "saved") continue;
        blockedCampaigns.add(userId);
        if (result.status === "conflict") await CloudSession.loadCampaign();
      }
    } finally {
      syncingCampaigns.delete(userId);
    }
  }

  private static async resetCampaign(revision: number): Promise<CampaignSaveResult> {
    const api = await CloudSession.api();
    const session = CloudSession.current();
    if (!api || !session) return { status: "unavailable", revision };
    let response: Response;
    try {
      response = await fetch(`${api}/me/campaign/reset`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          operationId: crypto.randomUUID(),
          expectedRevision: revision,
          confirmed: true,
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
