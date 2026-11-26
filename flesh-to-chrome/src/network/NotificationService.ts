import { CloudSession } from "./CloudSession";

export interface GameNotification {
  id: string;
  category: "welcome" | "campaign" | "ending" | "match" | string;
  target: string;
  createdAt: string;
  read: boolean;
}

export interface NotificationPreferences {
  categories: Record<string, boolean>;
  channels: { game: boolean; email: boolean };
  revision: number;
}

interface ServiceResult<T> {
  status: "ok" | "unauthenticated" | "conflict" | "unavailable";
  value?: T;
}

export class NotificationService {
  static list(): Promise<ServiceResult<{ items: GameNotification[]; nextCursor: string | null }>> {
    return NotificationService.request("/me/notifications");
  }

  static preferences(): Promise<ServiceResult<NotificationPreferences>> {
    return NotificationService.request("/me/notification-preferences");
  }

  static markRead(id: string): Promise<ServiceResult<{ id: string; read: boolean }>> {
    return NotificationService.request(`/me/notifications/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ read: true }),
    });
  }

  static updatePreferences(preferences: NotificationPreferences): Promise<ServiceResult<NotificationPreferences>> {
    return NotificationService.request("/me/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify({ expectedRevision: preferences.revision, preferences }),
    });
  }

  private static async request<T>(path: string, init: RequestInit = {}): Promise<ServiceResult<T>> {
    const session = CloudSession.current();
    if (!session) return { status: "unauthenticated" };
    const api = await CloudSession.api();
    const current = CloudSession.current();
    if (!api) return { status: "unavailable" };
    if (!current || current.profile.id !== session.profile.id || current.accessToken !== session.accessToken) {
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
      if (response.status === 401 || response.status === 403) return { status: "unauthenticated" };
      if (response.status === 409) return { status: "conflict" };
      if (!response.ok) return { status: "unavailable" };
      const after = CloudSession.current();
      if (!after || after.profile.id !== session.profile.id || after.accessToken !== session.accessToken) {
        return { status: "unauthenticated" };
      }
      return { status: "ok", value: await response.json() as T };
    } catch {
      return { status: "unavailable" };
    }
  }
}
