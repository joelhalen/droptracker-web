/**
 * Server-side Web API v1 client used by the BFF (Server Components and Route
 * Handlers). The browser never calls the Web API directly — only Next.js
 * (FRONTEND_PLAN.md §3.1).
 *
 * When `USE_MOCK_API` is set (default in dev) and the real API is unreachable,
 * requests fall back to built-in mock payloads so the UI is runnable before the
 * backend exists.
 */
import { cookies } from "next/headers";
import {
  AccountSettingsSchema,
  AnnouncementPageSchema,
  GroupProfileSchema,
  LeaderboardPageSchema,
  MeSchema,
  PlayerProfileSchema,
  SearchResultsSchema,
  type AccountSettings,
  type AccountSettingsPatch,
  type AnnouncementPage,
  type GroupConfigPatch,
  type GroupProfile,
  type LeaderboardPage,
  type ManualSubmission,
  type Me,
  type PlayerProfile,
  type SearchResults,
} from "@droptracker/api-types";
import { env, SESSION_COOKIE } from "./env";
import {
  mockAccountSettings,
  mockAnnouncements,
  mockGroupConfig,
  mockGroupLeaderboard,
  mockGroupProfile,
  mockMe,
  mockPlayerLeaderboard,
  mockPlayerProfile,
  mockSearch,
} from "./mock-data";

type FetchOpts = {
  /** Forward the caller's session cookie to the Web API (authed routes). */
  authed?: boolean;
  /** Next.js cache revalidation window in seconds (ISR for public reads). */
  revalidate?: number;
};

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function apiGet(path: string, opts: FetchOpts = {}): Promise<unknown> {
  const url = `${env.webApiInternalUrl}/api/v1${path}`;
  const headers: Record<string, string> = { accept: "application/json" };

  if (opts.authed) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) headers.cookie = `${SESSION_COOKIE}=${token}`;
  }

  const res = await fetch(url, {
    headers,
    next: opts.revalidate != null ? { revalidate: opts.revalidate } : undefined,
  });

  if (!res.ok) throw new ApiError(res.status, `Web API ${res.status} for ${path}`);
  return res.json();
}

async function apiSend(
  method: "POST" | "PATCH" | "PUT",
  path: string,
  body: unknown,
): Promise<unknown> {
  const url = `${env.webApiInternalUrl}/api/v1${path}`;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const res = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(token ? { cookie: `${SESSION_COOKIE}=${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, `Web API ${res.status} for ${method} ${path}`);
  return res.status === 204 ? null : res.json();
}

/** True when the caller holds a session cookie (real or dev-mock). */
async function hasSessionCookie(): Promise<boolean> {
  return Boolean((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Run `fetcher`; if the Web API is down and mocks are enabled, use `fallback`. */
async function withFallback<T>(fetcher: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await fetcher();
  } catch (err) {
    if (env.useMockApi) {
      console.warn(`[api] falling back to mock data:`, (err as Error).message);
      return fallback();
    }
    throw err;
  }
}

export const api = {
  async playerLeaderboard(params: {
    period?: string;
    scope?: string;
    page?: number;
    limit?: number;
  }): Promise<LeaderboardPage> {
    const q = new URLSearchParams();
    if (params.period) q.set("period", params.period);
    if (params.scope) q.set("scope", params.scope);
    if (params.page) q.set("page", String(params.page));
    if (params.limit) q.set("limit", String(params.limit));
    return withFallback(
      async () => LeaderboardPageSchema.parse(await apiGet(`/leaderboards/players?${q}`, { revalidate: 15 })),
      () => mockPlayerLeaderboard(params.page ?? 1, params.limit ?? 25),
    );
  },

  async groupLeaderboard(params: { period?: string; page?: number; limit?: number }): Promise<LeaderboardPage> {
    const q = new URLSearchParams();
    if (params.period) q.set("period", params.period);
    if (params.page) q.set("page", String(params.page));
    if (params.limit) q.set("limit", String(params.limit));
    return withFallback(
      async () => LeaderboardPageSchema.parse(await apiGet(`/leaderboards/groups?${q}`, { revalidate: 15 })),
      () => mockGroupLeaderboard(params.page ?? 1, params.limit ?? 25),
    );
  },

  async player(id: number): Promise<PlayerProfile> {
    return withFallback(
      async () => PlayerProfileSchema.parse(await apiGet(`/players/${id}`, { revalidate: 30 })),
      () => mockPlayerProfile(id),
    );
  },

  async group(id: number): Promise<GroupProfile> {
    return withFallback(
      async () => GroupProfileSchema.parse(await apiGet(`/groups/${id}`, { revalidate: 30 })),
      () => mockGroupProfile(id),
    );
  },

  async announcements(scope = "global"): Promise<AnnouncementPage> {
    return withFallback(
      async () =>
        AnnouncementPageSchema.parse(
          await apiGet(`/announcements?scope=${encodeURIComponent(scope)}`, { revalidate: 30 }),
        ),
      () => mockAnnouncements(),
    );
  },

  async me(): Promise<Me | null> {
    try {
      return MeSchema.parse(await apiGet(`/me`, { authed: true }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      // In mock mode, treat any present session cookie (incl. the dev mock
      // login) as an authenticated mock user so the dashboard is demonstrable.
      if (env.useMockApi) return (await hasSessionCookie()) ? mockMe() : null;
      throw err;
    }
  },

  async settings(): Promise<AccountSettings> {
    return withFallback(
      async () => AccountSettingsSchema.parse(await apiGet(`/me/settings`, { authed: true })),
      () => mockAccountSettings(),
    );
  },

  async updateSettings(patch: AccountSettingsPatch): Promise<AccountSettings> {
    return withFallback(
      async () => AccountSettingsSchema.parse(await apiSend("PATCH", `/me`, patch)),
      () => ({ ...mockAccountSettings(), ...patch }),
    );
  },

  async search(q: string): Promise<SearchResults> {
    if (!q.trim()) return { players: [], groups: [] };
    return withFallback(
      async () =>
        SearchResultsSchema.parse(await apiGet(`/search?q=${encodeURIComponent(q)}`, { revalidate: 10 })),
      () => mockSearch(q),
    );
  },

  async groupConfig(groupId: number): Promise<Record<string, string | number | boolean | null>> {
    return withFallback(
      async () =>
        (await apiGet(`/groups/${groupId}/config`, { authed: true })) as Record<
          string,
          string | number | boolean | null
        >,
      () => mockGroupConfig(),
    );
  },

  async updateGroupConfig(groupId: number, patch: GroupConfigPatch): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("PATCH", `/groups/${groupId}/config`, patch);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  async manualSubmit(input: ManualSubmission): Promise<{ id: number }> {
    return withFallback(
      async () => (await apiSend("POST", `/submissions/manual`, input)) as { id: number },
      () => ({ id: Math.floor(Math.random() * 100000) }),
    );
  },
};
