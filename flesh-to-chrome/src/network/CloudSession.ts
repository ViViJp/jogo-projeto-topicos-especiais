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

interface SessionResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  profile: PlayerProfile;
}

let apiBase: string | null = null;
let publishedApi = "";

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
    if (response.status === 404) return { status: "none", revision: 0, save: null };
    if (!response.ok) return { status: "unavailable", revision: 0, save: null };
    const body = (await response.json()) as { revision?: number; state?: Parameters<typeof fromApiState>[0] };
    if (!body.state || typeof body.revision !== "number") return { status: "unavailable", revision: 0, save: null };
    return { status: "present", revision: body.revision, save: fromApiState(body.state) };
  }

  static async saveCampaign(
    save: SaveData,
    revision: number,
    source: "guest-import" | "local-sync"
  ): Promise<"saved" | "conflict" | "unavailable"> {
    const api = await CloudSession.api();
    const session = CloudSession.current();
    if (!api || !session) return "unavailable";
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
      return "unavailable";
    }
    if (response.status === 409) return "conflict";
    if (!response.ok) return "unavailable";
    return "saved";
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
