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

interface SessionResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  profile: PlayerProfile;
}

let apiBase: string | null = null;

export class CloudSession {
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
    const fromQuery = new URLSearchParams(window.location.search).get("api");
    if (fromQuery) {
      apiBase = fromQuery.replace(/\/$/, "");
      return apiBase;
    }
    try {
      const response = await fetch("/cloud-config.json", { cache: "no-store" });
      if (!response.ok) return null;
      const body = (await response.json()) as { api?: string };
      if (!body.api) return null;
      apiBase = body.api.replace(/\/$/, "");
      return apiBase;
    } catch {
      return null;
    }
  }

  static async completeLoginIfNeeded(): Promise<PlayerSession | null> {
    const ticket = new URLSearchParams(window.location.search).get("ticket");
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
    const url = new URL(window.location.href);
    url.searchParams.delete("ticket");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
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

  static async campaign(): Promise<"present" | "none" | "unavailable"> {
    const api = await CloudSession.api();
    const session = CloudSession.current();
    if (!api || !session) return "unavailable";
    const response = await fetch(`${api}/me/campaign`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    if (response.status === 404) return "none";
    if (!response.ok) return "unavailable";
    return "present";
  }
}
