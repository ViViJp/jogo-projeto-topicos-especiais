import { CloudSession } from "./CloudSession";

export interface MatchParticipantResult {
  rawTimeMs: number | null;
  credits: number;
  dnf: boolean;
}

export interface MatchResult {
  winnerUserId: string | null;
  reason: "completed" | "abandon";
  finishedAt?: string;
  standings?: Array<MatchParticipantResult & {
    userId: string;
    place: number | null;
    adjustedTimeMs: number | null;
  }>;
}

export interface RemoteMatch {
  id: string;
  state: "lobby" | "running" | "finished" | "cancelled";
  track: string;
  rulesVersion: number;
  lobbyExpiresAt: string;
  hostUserId: string;
  guestUserId: string | null;
  inviteCode?: string;
  ready: Record<string, boolean>;
  result: MatchResult | null;
  revision: number;
}

export interface MatchHistoryItem {
  matchId: string;
  at: string;
  result: MatchResult;
}

export interface MatchApiResult<T> {
  status: "ok" | "unauthenticated" | "invalid" | "conflict" | "unavailable";
  value?: T;
  code?: string;
}

export class MatchService {
  static operationId(): string {
    return crypto.randomUUID();
  }

  static create(operationId: string): Promise<MatchApiResult<RemoteMatch>> {
    return MatchService.request("/matches", {
      method: "POST",
      body: JSON.stringify({ operationId }),
    });
  }

  static join(inviteCode: string, operationId: string): Promise<MatchApiResult<RemoteMatch>> {
    return MatchService.request("/matches/join", {
      method: "POST",
      body: JSON.stringify({ operationId, inviteCode }),
    });
  }

  static read(matchId: string): Promise<MatchApiResult<RemoteMatch>> {
    return MatchService.request(`/matches/${encodeURIComponent(matchId)}`);
  }

  static ready(matchId: string, operationId: string): Promise<MatchApiResult<RemoteMatch>> {
    return MatchService.request(`/matches/${encodeURIComponent(matchId)}/ready`, {
      method: "POST",
      body: JSON.stringify({ operationId }),
    });
  }

  static leave(matchId: string, operationId: string): Promise<MatchApiResult<RemoteMatch>> {
    return MatchService.request(`/matches/${encodeURIComponent(matchId)}/leave`, {
      method: "POST",
      body: JSON.stringify({ operationId }),
    });
  }

  static finish(
    matchId: string,
    participants: Record<string, MatchParticipantResult>,
    operationId: string,
  ): Promise<MatchApiResult<RemoteMatch>> {
    return MatchService.request(`/matches/${encodeURIComponent(matchId)}/finish`, {
      method: "POST",
      body: JSON.stringify({ operationId, participants }),
    });
  }

  static history(): Promise<MatchApiResult<{ items: MatchHistoryItem[]; nextCursor: string | null }>> {
    return MatchService.request("/me/matches");
  }

  private static async request<T>(path: string, init: RequestInit = {}): Promise<MatchApiResult<T>> {
    const session = CloudSession.current();
    if (!session) return { status: "unauthenticated" };
    const api = await CloudSession.api();
    const current = CloudSession.current();
    if (!api || !current || current.profile.id !== session.profile.id || current.accessToken !== session.accessToken) {
      return { status: "unauthenticated" };
    }
    try {
      const response = await fetch(`${api}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${session.accessToken}`,
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...init.headers,
        },
      });
      let body: T | { error?: { code?: string } } | undefined;
      try {
        body = await response.json() as T | { error?: { code?: string } };
      } catch {
        body = undefined;
      }
      const after = CloudSession.current();
      if (!after || after.profile.id !== session.profile.id || after.accessToken !== session.accessToken) {
        return { status: "unauthenticated" };
      }
      if (response.ok) return { status: "ok", value: body as T };
      const code = (body as { error?: { code?: string } } | undefined)?.error?.code;
      if (response.status === 401 || response.status === 403) return { status: "unauthenticated", code };
      if (response.status === 409) return { status: "conflict", code };
      if (response.status === 404 || response.status === 422) return { status: "invalid", code };
      return { status: "unavailable", code };
    } catch {
      return { status: "unavailable" };
    }
  }
}
