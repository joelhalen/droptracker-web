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
  AnnouncementSchema,
  CheckoutSessionSchema,
  DocSchema,
  DocSummarySchema,
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
  type Announcement,
  type AnnouncementInput,
  type AnnouncementPage,
  type CheckoutSession,
  type CreateGroupInput,
  type DiscordSendInput,
  type Doc,
  type DocInput,
  type DocSummary,
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

  if (!res.ok) throw new ApiError(res.status, await problemDetail(res, path));
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
  if (!res.ok) throw new ApiError(res.status, await problemDetail(res, `${method} ${path}`));
  return res.status === 204 ? null : res.json();
}

/** Extract the RFC-7807 `detail` from an error response, falling back to a generic message. */
async function problemDetail(res: Response, context: string): Promise<string> {
  try {
    const body = (await res.clone().json()) as { detail?: string; title?: string };
    if (body?.detail) return body.detail;
    if (body?.title) return body.title;
  } catch {
    /* not JSON */
  }
  return `Web API ${res.status} for ${context}`;
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

/* -------------------------------------------------------------------------- */
/* Superadmin dashboard contract (site-superadmin dashboard).                 */
/* These shapes are hand-declared here until they land in @droptracker/api-    */
/* types (backend agent owns that package). Keep them in sync with the         */
/* backend contract; this file is the front-end's single import surface.       */
/* -------------------------------------------------------------------------- */

/** A single KPI on the admin overview dashboard. */
export interface AdminOverviewStat {
  key: string;
  label: string;
  value: string | number;
  hint?: string;
}

/** GET /admin/overview */
export interface AdminOverview {
  stats: AdminOverviewStat[];
  /** Unix seconds or ISO timestamp of when the snapshot was computed. */
  generated_at: number | string;
}

/** Whitelisted, safe-to-browse entities for the data viewer/editor. */
export const ADMIN_DATA_ENTITIES = [
  "players",
  "groups",
  "users",
  "group_configurations",
  "subscription_tiers",
  "group_subscriptions",
  "audit_log",
  "announcements",
  "notification_queue",
  "discord_outbox",
] as const;
export type AdminDataEntity = (typeof ADMIN_DATA_ENTITIES)[number];

export type AdminDataRow = Record<string, unknown>;

/** GET /admin/data/{entity} */
export interface AdminDataList {
  entity: string;
  columns: string[];
  rows: AdminDataRow[];
  editable: string[];
  meta: { page: number; limit: number; total: number };
}

/** GET /admin/data/{entity}/{id} */
export interface AdminDataRecord {
  entity: string;
  id: string | number;
  record: AdminDataRow;
  editable: string[];
}

/** GET /admin/logs */
export interface AdminLogEntry {
  ts: number;
  level: string;
  source: string;
  message: string;
}
export interface AdminLogs {
  entries: AdminLogEntry[];
  sources: string[];
}

/** GET /admin/groups/{groupId}/overview */
export interface AdminGroupOverview {
  group: {
    id: number;
    name: string;
    member_count: number;
    guild_id: string | null;
    wom_id: number | null;
  };
  subscription: GroupSubscription | null;
  config_summary: Record<string, unknown>;
  activity_7d: { date: string; submissions: number }[];
  last_submission_ts: number | null;
  warnings: string[];
}

/** GET /admin/audit */
export interface AdminAuditActor {
  user_id: number;
  discord_id: string | null;
  username: string | null;
}
export interface AdminAuditEntry {
  id: number;
  actor: AdminAuditActor | null;
  group_id: number | null;
  action: string;
  target: string | null;
  before: string | null;
  after: string | null;
  created_at: number | null;
}
export interface AdminAuditLog {
  entries: AdminAuditEntry[];
  meta: { page: number; limit: number; total: number };
}

/** GET /admin/users/{id}/overview */
export interface AdminUserOverview {
  user: {
    user_id: number;
    discord_id: string | null;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_superadmin: boolean;
    public: boolean;
    hidden: boolean;
    date_added: number | null;
  };
  players: { id: number; name: string; wom_id: number | null; hidden: boolean }[];
  groups: { id: number; name: string; role: string }[];
  recent_audit: AdminAuditEntry[];
}

/* -------------------------------------------------------------------------- */
/* Group config: Discord channel picker (typed config editor "channel" fields). */
/* -------------------------------------------------------------------------- */

/** GET /groups/{id}/discord-channels */
export interface DiscordChannel {
  id: string;
  name: string;
  position: number;
}
export interface DiscordChannelList {
  channels: DiscordChannel[];
  /** False when the bot hasn't cached this guild's channels yet (or is down) —
   * the frontend must still allow typing a raw channel id in that case. */
  cached: boolean;
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

  async updateEvent(
    eventId: number,
    patch: Partial<Pick<EventInput, "name" | "description" | "starts_at" | "ends_at">>,
  ): Promise<EventDetail> {
    return withFallback(
      async () => EventDetailSchema.parse(await apiSend("PATCH", `/events/${eventId}`, patch)),
      () => mockEvent(eventId),
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

  /** Text channels in the group's linked Discord guild, cached by the bot (never a live Discord call). */
  async groupDiscordChannels(groupId: number): Promise<DiscordChannelList> {
    return withFallback(
      async () =>
        (await apiGet(`/groups/${groupId}/discord-channels`, { authed: true })) as DiscordChannelList,
      () => ({
        channels: [
          { id: "111111111111111111", name: "drops", position: 0 },
          { id: "222222222222222222", name: "lootboard", position: 1 },
          { id: "333333333333333333", name: "announcements", position: 2 },
        ],
        cached: true,
      }),
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

  /** Presign a direct-to-B2 upload for proof media on a manual submission. */
  async uploadPresign(
    contentType: string,
  ): Promise<{ upload_url: string; key: string; public_url: string }> {
    const q = new URLSearchParams({ content_type: contentType, kind: "image" });
    return withFallback(
      async () =>
        (await apiGet(`/uploads/presign?${q}`, { authed: true })) as {
          upload_url: string;
          key: string;
          public_url: string;
        },
      () => ({ upload_url: "", key: `uploads/mock-${Date.now()}.png`, public_url: "" }),
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

  async updateAnnouncement(
    id: number,
    patch: Partial<Pick<Announcement, "title" | "body_md" | "pinned" | "cover_image_url">>,
  ): Promise<Announcement> {
    return withFallback(
      async () => AnnouncementSchema.parse(await apiSend("PATCH", `/announcements/${id}`, patch)),
      () => ({ id, scope_type: "global" as const, title: "", body_md: "", pinned: false, published_at: 0, ...patch }),
    );
  },

  async archiveAnnouncement(id: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/announcements/${id}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
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

  async adminServiceAction(
    unit: string,
    action: ServiceAction["action"],
    confirm = false,
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/admin/services/${encodeURIComponent(unit)}`, { action, confirm });
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

  // --- Superadmin dashboard: overview -----------------------------------
  async adminOverview(): Promise<AdminOverview> {
    return withFallback(
      async () => (await apiGet(`/admin/overview`, { authed: true })) as AdminOverview,
      () => ({
        stats: [
          { key: "players", label: "Players", value: "—", hint: "API unavailable (mock mode)" },
          { key: "groups", label: "Groups", value: "—" },
          { key: "drops_24h", label: "Drops (24h)", value: "—" },
          { key: "queue", label: "Notification queue", value: "—" },
        ],
        generated_at: Math.floor(Date.now() / 1000),
      }),
    );
  },

  // --- Superadmin dashboard: comped subscriptions -----------------------
  async adminGrantSubscription(
    groupId: number,
    tierKey: string,
    days: number,
  ): Promise<GroupSubscription> {
    return withFallback(
      async () =>
        GroupSubscriptionSchema.parse(
          await apiSend("POST", `/admin/groups/${groupId}/subscription/grant`, {
            tier_key: tierKey,
            days,
          }),
        ),
      () => ({
        group_id: groupId,
        tier_key: tierKey,
        status: "active" as const,
        provider: "manual" as const,
        current_period_end: Math.floor(Date.now() / 1000) + days * 86400,
        cancel_at_period_end: false,
      }),
    );
  },

  async adminRevokeSubscription(groupId: number): Promise<GroupSubscription> {
    return withFallback(
      async () =>
        GroupSubscriptionSchema.parse(
          await apiSend("POST", `/admin/groups/${groupId}/subscription/revoke`, {}),
        ),
      () => ({
        group_id: groupId,
        tier_key: null,
        status: "canceled" as const,
        provider: null,
        current_period_end: null,
        cancel_at_period_end: false,
      }),
    );
  },

  // --- Superadmin dashboard: whitelisted data viewer/editor -------------
  async adminDataList(
    entity: string,
    params: { q?: string; page?: number; limit?: number } = {},
  ): Promise<AdminDataList> {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return withFallback(
      async () =>
        (await apiGet(`/admin/data/${encodeURIComponent(entity)}${suffix}`, {
          authed: true,
        })) as AdminDataList,
      () => ({
        entity,
        columns: [],
        rows: [],
        editable: [],
        meta: { page: params.page ?? 1, limit: params.limit ?? 25, total: 0 },
      }),
    );
  },

  async adminDataRecord(entity: string, id: string | number): Promise<AdminDataRecord> {
    return withFallback(
      async () =>
        (await apiGet(`/admin/data/${encodeURIComponent(entity)}/${encodeURIComponent(String(id))}`, {
          authed: true,
        })) as AdminDataRecord,
      () => ({ entity, id, record: {}, editable: [] }),
    );
  },

  async adminDataUpdate(
    entity: string,
    id: string | number,
    fields: Record<string, unknown>,
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend(
          "PATCH",
          `/admin/data/${encodeURIComponent(entity)}/${encodeURIComponent(String(id))}`,
          { fields },
        );
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  // --- Superadmin dashboard: logs ---------------------------------------
  async adminLogs(params: { source?: string; limit?: number } = {}): Promise<AdminLogs> {
    const qs = new URLSearchParams();
    if (params.source) qs.set("source", params.source);
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return withFallback(
      async () => (await apiGet(`/admin/logs${suffix}`, { authed: true })) as AdminLogs,
      () => ({ entries: [], sources: [] }),
    );
  },

  // --- Superadmin dashboard: group introspection ------------------------
  async adminGroupOverview(groupId: number): Promise<AdminGroupOverview> {
    return withFallback(
      async () =>
        (await apiGet(`/admin/groups/${groupId}/overview`, { authed: true })) as AdminGroupOverview,
      () => ({
        group: { id: groupId, name: `Group #${groupId}`, member_count: 0, guild_id: null, wom_id: null },
        subscription: null,
        config_summary: {},
        activity_7d: [],
        last_submission_ts: null,
        warnings: ["API unavailable (mock mode)."],
      }),
    );
  },

  // --- Superadmin dashboard: audit log -----------------------------------
  async adminAuditLog(
    params: { action?: string; actorUserId?: number; groupId?: number; q?: string; page?: number; limit?: number } = {},
  ): Promise<AdminAuditLog> {
    const qs = new URLSearchParams();
    if (params.action) qs.set("action", params.action);
    if (params.actorUserId) qs.set("actor_user_id", String(params.actorUserId));
    if (params.groupId) qs.set("group_id", String(params.groupId));
    if (params.q) qs.set("q", params.q);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return withFallback(
      async () => (await apiGet(`/admin/audit${suffix}`, { authed: true })) as AdminAuditLog,
      () => ({ entries: [], meta: { page: params.page ?? 1, limit: params.limit ?? 50, total: 0 } }),
    );
  },

  // --- Superadmin dashboard: user moderation ------------------------------
  async adminUserOverview(userId: number): Promise<AdminUserOverview> {
    return withFallback(
      async () =>
        (await apiGet(`/admin/users/${userId}/overview`, { authed: true })) as AdminUserOverview,
      () => ({
        user: {
          user_id: userId,
          discord_id: null,
          username: null,
          display_name: `User #${userId}`,
          avatar_url: null,
          is_superadmin: false,
          public: true,
          hidden: false,
          date_added: null,
        },
        players: [],
        groups: [],
        recent_audit: [],
      }),
    );
  },

  async adminSetUserSuperadmin(userId: number, grant: boolean): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/admin/users/${userId}/superadmin`, { grant });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },
};
