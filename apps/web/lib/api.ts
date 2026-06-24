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
  CheckoutSessionSchema,
  GroupDiagnosticsSchema,
  GroupMembersPageSchema,
  GroupProfileSchema,
  AdminLookupResponseSchema,
  EventDetailSchema,
  EventSummarySchema,
  LootboardImageSchema,
  LootboardSchema,
  GroupSubscriptionSchema,
  GuildStatusSchema,
  LeaderboardPageSchema,
  MeSchema,
  PlayerProfileSchema,
  SearchResultsSchema,
  ServiceLogsSchema,
  ServiceStatusSchema,
  SubscriptionTierSchema,
  WomGroupPreviewSchema,
  WomSyncResultSchema,
  type AccountSettings,
  type AccountSettingsPatch,
  type AdminLookupResponse,
  type AnnouncementInput,
  type AnnouncementPage,
  type CheckoutSession,
  type CreateGroupInput,
  type DiscordSendInput,
  type EventDetail,
  type EventInput,
  type EventSummary,
  type EventTaskInput,
  type EventTeamInput,
  type GroupConfigPatch,
  type GroupDiagnostics,
  type GroupMembersPage,
  type GroupProfile,
  type GroupSubscription,
  type GuildStatus,
  type LeaderboardPage,
  type Lootboard,
  type LootboardImage,
  type ManualSubmission,
  type Me,
  type PlayerProfile,
  type SearchResults,
  type ServiceAction,
  type ServiceLogs,
  type ServiceStatus,
  type SubscriptionTier,
  type SubscriptionTierInput,
  type WomGroupPreview,
  type WomSyncResult,
} from "@droptracker/api-types";
import { env, SESSION_COOKIE } from "./env";
import {
  mockAccountSettings,
  mockAnnouncements,
  mockDiagnostics,
  mockGroupConfig,
  mockGroupLeaderboard,
  mockGroupMembers,
  mockGroupProfile,
  mockGroupSubscription,
  mockGuildStatus,
  mockEvent,
  mockEvents,
  mockLookup,
  mockLootboard,
  mockMe,
  mockPlayerLeaderboard,
  mockPlayerProfile,
  mockSearch,
  mockServiceLogs,
  mockServices,
  mockSubscriptionTiers,
  mockWomLookup,
  mockWomSync,
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
  method: "POST" | "PATCH" | "PUT" | "DELETE",
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

  // --- Events ------------------------------------------------------------
  async events(params: { groupId?: number; status?: "active" | "past" } = {}): Promise<EventSummary[]> {
    const q = new URLSearchParams();
    if (params.groupId) q.set("groupId", String(params.groupId));
    if (params.status) q.set("status", params.status);
    return withFallback(
      async () => EventSummarySchema.array().parse(await apiGet(`/events?${q}`, { revalidate: 30 })),
      () => mockEvents(params.groupId, params.status),
    );
  },

  async event(id: number): Promise<EventDetail> {
    return withFallback(
      async () => EventDetailSchema.parse(await apiGet(`/events/${id}`, { revalidate: 30 })),
      () => mockEvent(id),
    );
  },

  async createEvent(input: EventInput): Promise<{ id: number }> {
    return withFallback(
      async () => (await apiSend("POST", `/events`, input)) as { id: number },
      () => ({ id: Math.floor(100 + Math.random() * 900) }),
    );
  },

  async addEventTask(eventId: number, input: EventTaskInput): Promise<{ id: number }> {
    return withFallback(
      async () => (await apiSend("POST", `/events/${eventId}/tasks`, input)) as { id: number },
      () => ({ id: Math.floor(Math.random() * 100000) }),
    );
  },

  async deleteEventTask(eventId: number, taskId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/events/${eventId}/tasks/${taskId}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  async addEventTeam(eventId: number, input: EventTeamInput): Promise<{ id: number }> {
    return withFallback(
      async () => (await apiSend("POST", `/events/${eventId}/teams`, input)) as { id: number },
      () => ({ id: Math.floor(Math.random() * 100000) }),
    );
  },

  async lootboard(groupId: number, period = "all"): Promise<Lootboard> {
    return withFallback(
      async () =>
        LootboardSchema.parse(
          await apiGet(`/groups/${groupId}/lootboard?period=${encodeURIComponent(period)}`, {
            revalidate: 30,
          }),
        ),
      () => mockLootboard(groupId, period),
    );
  },

  /** Trigger the legacy image generator (share affordance, FRONTEND_PLAN.md §12). */
  async generateLootboardImage(groupId: number, period = "all"): Promise<LootboardImage> {
    return withFallback(
      async () =>
        LootboardImageSchema.parse(
          await apiSend("POST", `/groups/${groupId}/lootboard/generate`, { period }),
        ),
      () => ({ url: null }),
    );
  },

  async announcements(scope = "global"): Promise<AnnouncementPage> {
    return withFallback(
      async () =>
        AnnouncementPageSchema.parse(
          await apiGet(`/announcements?scope=${encodeURIComponent(scope)}`, { revalidate: 30 }),
        ),
      () => mockAnnouncements(scope),
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

  // --- Announcements (write) --------------------------------------------
  async createAnnouncement(input: AnnouncementInput): Promise<{ id: number }> {
    const path =
      input.scope_type === "group" && input.group_id
        ? `/groups/${input.group_id}/announcements`
        : `/announcements`;
    return withFallback(
      async () => (await apiSend("POST", path, input)) as { id: number },
      () => ({ id: Math.floor(Math.random() * 100000) }),
    );
  },

  // --- Group admin -------------------------------------------------------
  async groupMembers(groupId: number, page = 1): Promise<GroupMembersPage> {
    return withFallback(
      async () =>
        GroupMembersPageSchema.parse(
          await apiGet(`/groups/${groupId}/members?page=${page}`, { authed: true }),
        ),
      () => mockGroupMembers(groupId, page),
    );
  },

  async setHiddenPlayer(
    groupId: number,
    playerId: number,
    hidden: boolean,
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("PATCH", `/groups/${groupId}/hidden-players`, {
          player_id: playerId,
          hidden,
        });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  async womSync(groupId: number): Promise<WomSyncResult> {
    return withFallback(
      async () => WomSyncResultSchema.parse(await apiSend("POST", `/groups/${groupId}/wom-sync`, {})),
      () => mockWomSync(),
    );
  },

  async diagnostics(groupId: number): Promise<GroupDiagnostics> {
    return withFallback(
      async () =>
        GroupDiagnosticsSchema.parse(await apiGet(`/groups/${groupId}/diagnostics`, { authed: true })),
      () => mockDiagnostics(),
    );
  },

  // --- Group creation wizard --------------------------------------------
  async womLookup(womId: number): Promise<WomGroupPreview> {
    return withFallback(
      async () => WomGroupPreviewSchema.parse(await apiGet(`/groups/wom-lookup/${womId}`, { authed: true })),
      () => mockWomLookup(womId),
    );
  },

  async guildStatus(guildId: string): Promise<GuildStatus> {
    return withFallback(
      async () =>
        GuildStatusSchema.parse(
          await apiGet(`/groups/guild-status/${encodeURIComponent(guildId)}`, { authed: true }),
        ),
      () => mockGuildStatus(guildId),
    );
  },

  async createGroup(input: CreateGroupInput): Promise<{ id: number }> {
    return withFallback(
      async () => (await apiSend("POST", `/groups`, input)) as { id: number },
      () => ({ id: Math.floor(100 + Math.random() * 900) }),
    );
  },

  // --- Group subscriptions / upgrades -----------------------------------
  async subscriptionTiers(): Promise<SubscriptionTier[]> {
    return withFallback(
      async () =>
        SubscriptionTierSchema.array().parse(
          await apiGet(`/subscriptions/tiers`, { revalidate: 300 }),
        ),
      () => mockSubscriptionTiers(),
    );
  },

  async groupSubscription(groupId: number): Promise<GroupSubscription> {
    return withFallback(
      async () =>
        GroupSubscriptionSchema.parse(await apiGet(`/groups/${groupId}/subscription`, { authed: true })),
      () => mockGroupSubscription(groupId),
    );
  },

  /** Begin (or switch to) a paid tier; returns a provider-hosted redirect URL. */
  async subscriptionCheckout(groupId: number, tierKey: string): Promise<CheckoutSession> {
    return withFallback(
      async () =>
        CheckoutSessionSchema.parse(
          await apiSend("POST", `/groups/${groupId}/subscription/checkout`, { tier_key: tierKey }),
        ),
      () => ({ url: null }),
    );
  },

  async cancelSubscription(groupId: number): Promise<GroupSubscription> {
    return withFallback(
      async () =>
        GroupSubscriptionSchema.parse(
          await apiSend("POST", `/groups/${groupId}/subscription/cancel`, {}),
        ),
      () => ({ ...mockGroupSubscription(groupId), cancel_at_period_end: true }),
    );
  },

  async resumeSubscription(groupId: number): Promise<GroupSubscription> {
    return withFallback(
      async () =>
        GroupSubscriptionSchema.parse(
          await apiSend("POST", `/groups/${groupId}/subscription/resume`, {}),
        ),
      () => ({ ...mockGroupSubscription(groupId), cancel_at_period_end: false }),
    );
  },

  /** Open the provider's billing portal (update card, invoices, cancel). */
  async billingPortal(groupId: number): Promise<CheckoutSession> {
    return withFallback(
      async () =>
        CheckoutSessionSchema.parse(await apiSend("POST", `/groups/${groupId}/subscription/portal`, {})),
      () => ({ url: null }),
    );
  },

  // --- Superadmin --------------------------------------------------------
  async adminServices(): Promise<ServiceStatus[]> {
    return withFallback(
      async () => ServiceStatusSchema.array().parse(await apiGet(`/admin/services`, { authed: true })),
      () => mockServices(),
    );
  },

  async adminServiceAction(unit: string, action: ServiceAction["action"]): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/admin/services/${encodeURIComponent(unit)}`, { action });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  async adminServiceLogs(unit: string): Promise<ServiceLogs> {
    return withFallback(
      async () =>
        ServiceLogsSchema.parse(
          await apiGet(`/admin/services/${encodeURIComponent(unit)}/logs`, { authed: true }),
        ),
      () => mockServiceLogs(unit),
    );
  },

  async adminSendDiscord(input: DiscordSendInput): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/admin/discord/send`, input);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  async adminLookup(q: string): Promise<AdminLookupResponse> {
    if (!q.trim()) return { results: [] };
    return withFallback(
      async () =>
        AdminLookupResponseSchema.parse(
          await apiGet(`/admin/lookup?q=${encodeURIComponent(q)}`, { authed: true }),
        ),
      () => mockLookup(q),
    );
  },

  async adminSaveTier(tier: SubscriptionTierInput, isNew: boolean): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend(
          isNew ? "POST" : "PATCH",
          isNew ? `/admin/subscriptions/tiers` : `/admin/subscriptions/tiers/${encodeURIComponent(tier.key)}`,
          tier,
        );
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  async adminDeleteTier(key: string): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/admin/subscriptions/tiers/${encodeURIComponent(key)}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },
};
