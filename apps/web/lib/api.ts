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
import { z } from "zod";
import {
  AccountSettingsSchema,
  AdminBadgeSchema,
  AnnouncementPageSchema,
  AnnouncementSchema,
  BadgeDefinitionSchema,
  PlayerBadgeSchema,
  CheckoutSessionSchema,
  DocSchema,
  DocSummarySchema,
  GroupDiagnosticsSchema,
  GroupMembersPageSchema,
  GroupProfileSchema,
  AdminLookupResponseSchema,
  PbBlockListSchema,
  PbBlockSearchResponseSchema,
  PbBlockMutationSchema,
  BingoBoardSchema,
  BoardDetailSchema,
  type BoardDetail,
  LootSweepBoardSchema,
  type LootSweepBoard,
  LootSweepReceiptsSchema,
  type LootSweepReceipts,
  LootSweepSummarySchema,
  type LootSweepSummary,
  BoardRollResultSchema,
  type BoardRollResult,
  BoardSettingsSchema,
  type BoardSettings,
  type BoardInput,
  BoardShopStateSchema,
  type BoardShopState,
  BoardShopConfigSchema,
  type BoardShopConfig,
  type BoardShopConfigInput,
  AdminShopItemSchema,
  type AdminShopItem,
  AdminEventTypeSchema,
  type AdminEventType,
  AdminEventRateLimitSchema,
  type AdminEventRateLimit,
  EventChannelConfigSchema,
  EventTeamDiscordConfigSchema,
  type EventTeamDiscordConfig,
  type EventTeamDiscordInput,
  TeamNotificationsSchema,
  type TeamNotifications,
  type EventTaskProgressMode,
  EventCompletionSchema,
  EventDetailSchema,
  EventPrizePotSchema,
  type EventPrizePot,
  type EventBuyinKind,
  type EventBuyinStatus,
  type EventPrizeDistribution,
  EventReadinessSchema,
  EventKindMetaSchema,
  type EventKindMeta,
  EventInvitationSchema,
  EventParticipantSchema,
  EventRecruitingItemSchema,
  EventSignupSchema,
  EventJoinResultSchema,
  EventRandomizeResultSchema,
  EventPopulateResultSchema,
  type EventSignup,
  type EventJoinResult,
  type EventRandomizeResult,
  type EventPopulateResult,
  EventTeamDetailSchema,
  EventTeamsResponseSchema,
  type EventTeamDetail,
  type EventTeamsResponse,
  EventPlayersResponseSchema,
  type EventPlayersResponse,
  EventPlayerDetailSchema,
  type EventPlayerDetail,
  TaskBreakdownSchema,
  type TaskBreakdown,
  EventSummarySchema,
  EventMetaEntrySchema,
  EventPetCategorySchema,
  type EventPetCategory,
  EventItemSourcesSchema,
  type EventItemSources,
  EventTaskLibraryItemSchema,
  EventTemplateSummarySchema,
  type EventTemplateSummary,
  EventTemplateDetailSchema,
  type EventTemplateDetail,
  type EventTemplateSaveInput,
  type EventTemplateInstantiateInput,
  EventTemplateInstantiateResultSchema,
  type EventTemplateInstantiateResult,
  type EventTemplatePatch,
  LootboardImageSchema,
  LootboardSchema,
  GroupEmbedSchema,
  GroupEmbedsResponseSchema,
  EventLayoutMetaSchema,
  EventLayoutsResponseSchema,
  EventMessageLayoutSchema,
  GroupEventLayoutsResponseSchema,
  type EventLayoutMeta,
  type EventLayoutsResponse,
  type EventMessageLayout,
  type EventMessageLayoutInput,
  type GroupEventLayoutsResponse,
  GroupSubscriptionSchema,
  MyNitroBoostSchema,
  NotificationPrefsSchema,
  GroupSubscriptionSummarySchema,
  AdminSubscriptionsOverviewSchema,
  BotInviteSchema,
  ClaimPreviewSchema,
  ClaimResultSchema,
  CreateGroupResultSchema,
  GuildStatusSchema,
  LeaderboardPageSchema,
  MeSchema,
  MyGuildsSchema,
  type BotInvite,
  type ClaimPreview,
  type ClaimResult,
  type CreateGroupResult,
  type MyGuilds,
  PlayerLootTrackerSchema,
  PlayerProfileSchema,
  SearchResultsSchema,
  ResolveResultSchema,
  type ResolveResult,
  PbBossBoardSchema,
  type PbBossBoard,
  PbBossIndexSchema,
  type PbBossIndex,
  ItemDetailSchema,
  type ItemDetail,
  NpcDetailSchema,
  type NpcDetail,
  NpcDropTableSchema,
  type NpcDropTable,
  ServiceLogsSchema,
  ServiceStatusSchema,
  BackupOverviewSchema,
  type BackupOverview,
  B2UsageSchema,
  type B2Usage,
  BackupOffsiteSchema,
  type BackupOffsite,
  SubscriptionTierSchema,
  SupportersSchema,
  type Supporters,
  AdminTicketPageSchema,
  SuggestionDetailSchema,
  SuggestionMessageSchema,
  SuggestionPageSchema,
  TicketDetailSchema,
  TicketPageSchema,
  TicketSummarySchema,
  WomGroupPreviewSchema,
  WomSyncResultSchema,
  type AccountSettings,
  type AccountSettingsPatch,
  type AdminBadge,
  type AdminBadgeInput,
  type AdminLookupResponse,
  type PbBlockList,
  type PbBlockSearchResponse,
  type PbBlockMutation,
  type BadgeDefinition,
  type PlayerBadge as PlayerBadgeAward,
  type Announcement,
  type AnnouncementInput,
  type GroupDiscordRoles,
  GroupDiscordRolesSchema,
  type AnnouncementPage,
  type BingoBoard,
  type BingoBoardInput,
  type CheckoutSession,
  type CreateGroupInput,
  type DiscordSendInput,
  type Doc,
  type DocInput,
  type DocSummary,
  type EventAwardInput,
  type EventChannelConfig,
  type EventChannelConfigInput,
  type EventCompletion,
  type EventDetail,
  type EventReadiness,
  type EventInput,
  type EventInvitation,
  type EventJoinInput,
  type EventParticipant,
  type EventRecruitingItem,
  type EventRevokeInput,
  type EventSummary,
  type EventTaskInput,
  type EventMetaEntry,
  type EventTaskLibraryItem,
  type EventTaskLibraryItemInput,
  type EventTaskLibraryItemPatch,
  type EventTaskPatch,
  type EventTeamInput,
  type EventTeamPatch,
  EventTeamBulkAddResultSchema,
  type EventTeamBulkAddResult,
  type EmbedType,
  type GroupConfigPatch,
  type GroupDiagnostics,
  type GroupEmbed,
  type GroupEmbedInput,
  type GroupEmbedsResponse,
  type GroupMembersPage,
  type GroupProfile,
  type GroupSubscription,
  type GroupSubscriptionSummary,
  type MyNitroBoost,
  type NotificationPrefs,
  type AdminSubscriptionsOverview,
  type GuildStatus,
  type LeaderboardPage,
  type Lootboard,
  type LootboardImage,
  type ManualSubmission,
  type ManualPreflight,
  ManualPreflightSchema,
  type ManualSubmissionQueue,
  ManualSubmissionQueueSchema,
  type Me,
  type PlayerLootTracker,
  type PlayerProfile,
  type SearchResults,
  type ServiceAction,
  type ServiceLogs,
  type ServiceStatus,
  type SubscriptionTier,
  type SubscriptionTierInput,
  type AuthorizedUsersResponse,
  AuthorizedUsersResponseSchema,
  type EventManagersResponse,
  EventManagersResponseSchema,
  type UserSubscription,
  UserSubscriptionSchema,
  type WomGroupPreview,
  type WomSyncResult,
  type AdminTicketPage,
  type SuggestionCreate,
  type SuggestionDetail,
  type SuggestionMessage,
  type SuggestionPage,
  type SuggestionReplyCreate,
  type TicketDetail,
  type TicketPage,
  type TicketSummary,
  type PointBoost,
  PointBoostSchema,
  type PointListEntry,
  PointListEntrySchema,
  type PointMod,
  PointModSchema,
  type PointSeason,
  PointSeasonSchema,
  type PointsAdjustResult,
  PointsAdjustResultSchema,
  type PointsBehavior,
  PointsBehaviorSchema,
  type PointsHistoryPage,
  PointsHistoryPageSchema,
  type PointsLeaderboard,
  PointsLeaderboardSchema,
  type PointsSettings,
  PointsSettingsSchema,
  type PointRule,
  PointRuleSchema,
  type ItemValueOverride,
  ItemValueOverrideSchema,
  type ItemValueOverrideInput,
  type ItemSearchResult,
  ItemSearchResultSchema,
  type PublicItemValue,
  PublicItemValueSchema,
} from "@droptracker/api-types";
import { env, SESSION_COOKIE } from "./env";
import {
  RedirectRuleSchema,
  RedirectSchema,
  type Redirect,
  type RedirectInput,
  type RedirectRule,
} from "./redirects";
import {
  mockAccountSettings,
  mockAnnouncements,
  mockDiagnostics,
  mockGroupConfig,
  mockGroupLeaderboard,
  mockGroupMembers,
  mockGroupProfile,
  mockGroupEmbeds,
  mockEventLayoutMeta,
  mockEventLayouts,
  mockGroupEventLayouts,
  mockGroupSubscription,
  mockGroupSubscriptionSummary,
  mockAdminSubscriptionsOverview,
  mockGuildStatus,
  mockAuthorizedUsers,
  mockEventManagers,
  mockUserSubscription,
  mockEvent,
  mockEventTeam,
  mockEventTeams,
  mockEventPlayers,
  mockEventPlayerDetail,
  mockEventCompletions,
  mockEventDiscord,
  mockEventTeamDiscord,
  mockEventDiscordChannels,
  mockEventDiscordGuilds,
  mockEventLootSweep,
  mockEventLootSweepReceipts,
  mockEvents,
  mockEventTaskLibrary,
  mockEventTemplates,
  mockEventTemplateDetail,
  mockAdminTickets,
  mockLookup,
  mockLootboard,
  mockManualSubmissions,
  mockMyTickets,
  mockSuggestionDetail,
  mockSuggestions,
  mockTicket,
  mockMe,
  mockPlayerLeaderboard,
  mockPlayerLoot,
  mockPlayerProfile,
  mockSearch,
  mockResolve,
  mockPbBoard,
  mockPbBosses,
  mockItemDetail,
  mockNpcDetail,
  mockNpcDropTable,
  mockB2Usage,
  mockBackupOffsite,
  mockBackupOverview,
  mockServiceLogs,
  mockServices,
  mockBotInvite,
  mockClaimPreview,
  mockClaimResult,
  mockManageableGuilds,
  mockSubscriptionTiers,
  mockSupporters,
  mockWomLookup,
  mockWomSync,
} from "./mock-data";

type FetchOpts = {
  /** Forward the caller's session cookie to the Web API (authed routes). */
  authed?: boolean;
  /** Next.js cache revalidation window in seconds (ISR for public reads). */
  revalidate?: number;
  /**
   * Internal render token (X-Board-Image-Token) — lets the chrome-less
   * board-image route read ANY event (incl. private/draft) for the Discord
   * screenshot, bypassing the viewer-visibility gate on the backend.
   */
  internalToken?: string;
};

/**
 * One entry of `/feed/recent` (Redis history behind the live ticker). Unlike
 * live SSE frames (`RealtimeEventSchema`) the history entries carry `ts`
 * inside `data` and no top-level timestamp, so they get their own shape here.
 */
const FeedEventSchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});
export type FeedEvent = z.infer<typeof FeedEventSchema>;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Parsed RFC-7807 body when the error response was JSON. Extension
     * members live here — e.g. the buy-in confirm-on-disable 409 carries
     * `{ type: "buyins-present", count, total }`. */
    public problem?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** Machine-readable reason code from an ApiError's problem body (the `code`
 * extension member — e.g. "event_private", "event_draft", "staff_required"),
 * or null. Lets pages branch on WHY access was denied without string-matching
 * human-readable titles. */
export function apiErrorCode(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const code = err.problem?.code;
  return typeof code === "string" ? code : null;
}

/** Build an ApiError from a non-OK response, parsing the RFC-7807 body once so
 * both the human message and any extension members (`count`/`total`/`type`)
 * are available to callers. */
async function apiError(res: Response, context: string): Promise<ApiError> {
  let problem: Record<string, unknown> | undefined;
  let message = `Web API ${res.status} for ${context}`;
  try {
    const body = (await res.clone().json()) as Record<string, unknown>;
    problem = body;
    if (typeof body?.detail === "string") message = body.detail;
    else if (typeof body?.title === "string") message = body.title;
  } catch {
    /* not JSON */
  }
  return new ApiError(res.status, message, problem);
}

async function apiGet(path: string, opts: FetchOpts = {}): Promise<unknown> {
  const url = `${env.webApiInternalUrl}/api/v1${path}`;
  const headers: Record<string, string> = { accept: "application/json" };

  if (opts.authed) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) headers.cookie = `${SESSION_COOKIE}=${token}`;
  }
  if (opts.internalToken) headers["x-board-image-token"] = opts.internalToken;

  const res = await fetch(url, {
    headers,
    next: opts.revalidate != null ? { revalidate: opts.revalidate } : undefined,
  });

  if (!res.ok) throw await apiError(res, path);
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
  if (!res.ok) throw await apiError(res, `${method} ${path}`);
  return res.status === 204 ? null : res.json();
}

/** Multipart variant of apiSend — lets fetch set the multipart boundary header. */
async function apiSendForm(method: "POST" | "PUT", path: string, form: FormData): Promise<unknown> {
  const url = `${env.webApiInternalUrl}/api/v1${path}`;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const res = await fetch(url, {
    method,
    headers: {
      accept: "application/json",
      ...(token ? { cookie: `${SESSION_COOKIE}=${token}` } : {}),
    },
    body: form,
  });
  if (!res.ok) throw await apiError(res, `${method} ${path}`);
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
    is_moderator: boolean;
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
  /** "text" (also the implied default for pre-migration cache entries),
   * "forum" (not directly messageable — only its threads are), or "thread"
   * (a forum post / channel thread; sendable exactly like a channel). */
  type?: "text" | "forum" | "thread";
  /** Threads only: id of the parent forum/text channel. */
  parent_id?: string;
}
export interface DiscordChannelList {
  channels: DiscordChannel[];
  /** False when the bot hasn't cached this guild's channels yet (or is down) —
   * the frontend must still allow typing a raw channel id in that case. */
  cached: boolean;
}

/** GET /groups/{id}/pb-bosses — boss names with at least one stored PB,
 * i.e. the valid values for `personal_best_embed_boss_list`. */
export interface PbBossList {
  bosses: string[];
  cached: boolean;
}

/** GET /lootboard-styles — the selectable lootboard style catalog
 * (backs the `loot_board_type` preview picker in the config editor). */
const LootboardStyleSchema = z.object({
  id: z.number(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  preview_url: z.string(),
});
const LootboardStyleListSchema = z.object({ styles: z.array(LootboardStyleSchema) });
export type LootboardStyle = z.infer<typeof LootboardStyleSchema>;
export type LootboardStyleList = z.infer<typeof LootboardStyleListSchema>;

/* -------------------------------------------------------------------------- */
/* Event Discord config (Task 19): guilds/channels from the bot's Redis caches. */
/* -------------------------------------------------------------------------- */

/** GET /events/discord/guilds — every guild the bot is a member of. */
export interface EventDiscordGuild {
  id: string;
  name: string;
  icon?: string | null;
}
export interface EventDiscordGuildList {
  guilds: EventDiscordGuild[];
  /** True when the bot hasn't refreshed `bot:guilds` yet (or is down) —
   * the UI falls back to manual guild-id entry. */
  stale: boolean;
}

/** GET /events/discord/guilds/{guildId}/channels */
export interface EventDiscordChannelList {
  channels: DiscordChannel[];
  /** True on a cold cache; the request also asks the bot to warm it, so a
   * retry usually succeeds within seconds. Manual-id entry stays available. */
  stale: boolean;
}

/* -------------------------------------------------------------------------- */
/* Completion history + manager audit log (web57a).                            */
/* -------------------------------------------------------------------------- */

/** GET /events/{id}/completions/history — public completion timeline. Hidden
 * players are masked to "Hidden player" for non-admin viewers server-side. */
const CompletionHistoryEntrySchema = z.object({
  completion_id: z.number(),
  task_id: z.number(),
  task_label: z.string().nullable(),
  task_type: z.string().nullable(),
  task_points: z.number(),
  team_id: z.number().nullable(),
  team_name: z.string().nullable(),
  player_id: z.number().nullable(),
  player_name: z.string().nullable(),
  hidden: z.boolean(),
  matched_target: z.string().nullable(),
  quantity: z.number(),
  points: z.number(),
  source_type: z.string().nullable(),
  status: z.string(),
  proof_url: z.string().nullable(),
  created_at: z.number().nullable(),
});
const CompletionHistorySchema = z.object({
  event_id: z.number(),
  kind: z.string(),
  is_admin: z.boolean(),
  entries: z.array(CompletionHistoryEntrySchema),
  meta: z.object({ page: z.number(), limit: z.number(), total: z.number() }),
});
export type CompletionHistory = z.infer<typeof CompletionHistorySchema>;
export type CompletionHistoryEntry = z.infer<typeof CompletionHistoryEntrySchema>;

/** GET /events/{id}/audit — event-scoped manager audit timeline (admin only). */
const AuditActorSchema = z.object({
  user_id: z.number(),
  discord_id: z.string().nullable(),
  username: z.string().nullable(),
});
const AuditEntrySchema = z.object({
  id: z.string(),
  source: z.enum(["ledger", "audit"]),
  category: z.string(),
  action: z.string(),
  completion_id: z.number().nullable(),
  created_at: z.number().nullable(),
  actor: AuditActorSchema.nullable(),
  task_id: z.number().nullable(),
  task_label: z.string().nullable(),
  team_id: z.number().nullable(),
  team_name: z.string().nullable(),
  player_id: z.number().nullable(),
  player_name: z.string().nullable(),
  matched_target: z.string().nullable(),
  quantity: z.number().nullable(),
  source_type: z.string().nullable(),
  status: z.string().nullable(),
  proof_url: z.string().nullable(),
  note: z.string().nullable(),
  before: z.string().nullable(),
  after: z.string().nullable(),
  target: z.string().nullable(),
  summary: z.string(),
});
const EventAuditSchema = z.object({
  event_id: z.number(),
  entries: z.array(AuditEntrySchema),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    capped: z.boolean(),
  }),
});
export type EventAudit = z.infer<typeof EventAuditSchema>;
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export interface EventAuditParams {
  page?: number;
  limit?: number;
  category?: string[];
  actorUserId?: number;
  playerId?: number;
  teamId?: number;
  taskId?: number;
  sourceType?: string;
  hasProof?: boolean;
  from?: number;
  to?: number;
  q?: string;
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
      async () =>
        LeaderboardPageSchema.parse(await apiGet(`/leaderboards/players?${q}`, { revalidate: 15 })),
      () => mockPlayerLeaderboard(params.page ?? 1, params.limit ?? 25),
    );
  },

  async groupLeaderboard(params: {
    period?: string;
    page?: number;
    limit?: number;
  }): Promise<LeaderboardPage> {
    const q = new URLSearchParams();
    if (params.period) q.set("period", params.period);
    if (params.page) q.set("page", String(params.page));
    if (params.limit) q.set("limit", String(params.limit));
    return withFallback(
      async () =>
        LeaderboardPageSchema.parse(await apiGet(`/leaderboards/groups?${q}`, { revalidate: 15 })),
      () => mockGroupLeaderboard(params.page ?? 1, params.limit ?? 25),
    );
  },

  async player(id: number): Promise<PlayerProfile> {
    return withFallback(
      async () => PlayerProfileSchema.parse(await apiGet(`/players/${id}`, { revalidate: 30 })),
      () => mockPlayerProfile(id),
    );
  },

  /** RuneLite-style loot tracker: one month of drops grouped by NPC. */
  async playerLoot(id: number, partition?: number): Promise<PlayerLootTracker> {
    const qs = partition ? `?partition=${partition}` : "";
    return withFallback(
      async () =>
        PlayerLootTrackerSchema.parse(await apiGet(`/players/${id}/loot${qs}`, { revalidate: 60 })),
      () => mockPlayerLoot(id, partition),
    );
  },

  async group(id: number): Promise<GroupProfile> {
    return withFallback(
      async () => GroupProfileSchema.parse(await apiGet(`/groups/${id}`, { revalidate: 30 })),
      () => mockGroupProfile(id),
    );
  },

  /** Upload a group icon (multipart 'file'); returns the stored public URL. */
  async uploadGroupIcon(groupId: number, form: FormData): Promise<{ icon_url: string }> {
    return z
      .object({ icon_url: z.string() })
      .parse(await apiSendForm("POST", `/groups/${groupId}/icon`, form));
  },

  async deleteGroupIcon(groupId: number): Promise<void> {
    await apiSend("DELETE", `/groups/${groupId}/icon`, {});
  },

  // --- Events ------------------------------------------------------------
  async events(
    params: { groupId?: number; status?: "active" | "past" } = {},
  ): Promise<EventSummary[]> {
    const q = new URLSearchParams();
    if (params.groupId) q.set("groupId", String(params.groupId));
    if (params.status) q.set("status", params.status);
    return withFallback(
      async () =>
        EventSummarySchema.array().parse(await apiGet(`/events?${q}`, { revalidate: 30 })),
      () => mockEvents(params.groupId, params.status),
    );
  },

  /** Authed event list: same endpoint, but with the session cookie so the
   * backend includes drafts the viewer administers (superadmin sees all,
   * including global drafts). Uncached (viewer-specific). */
  async eventsForAdmin(
    params: { groupId?: number; status?: "draft" | "active" | "past" } = {},
  ): Promise<EventSummary[]> {
    const q = new URLSearchParams();
    if (params.groupId) q.set("groupId", String(params.groupId));
    if (params.status) q.set("status", params.status);
    return withFallback(
      async () => EventSummarySchema.array().parse(await apiGet(`/events?${q}`, { authed: true })),
      () => mockEvents(params.groupId, params.status),
    );
  },

  async event(id: number): Promise<EventDetail> {
    return withFallback(
      async () => EventDetailSchema.parse(await apiGet(`/events/${id}`, { revalidate: 30 })),
      () => mockEvent(id),
    );
  },

  /** Event detail for the chrome-less board-image render — reads ANY event
   * (incl. private/draft) via the internal render token, no mock fallback. */
  async eventForRender(id: number, token: string): Promise<EventDetail> {
    return EventDetailSchema.parse(await apiGet(`/events/${id}`, { internalToken: token }));
  },

  /** Board-game board for the render page (internal render token). */
  async eventBoardForRender(eventId: number, token: string): Promise<BoardDetail> {
    return BoardDetailSchema.parse(
      await apiGet(`/events/${eventId}/board`, { internalToken: token }),
    );
  },

  /** Compact Loot Sweep standings for the render page (internal render token) —
   * the leaderboard the Discord board image screenshots. */
  async eventLootSweepSummaryForRender(
    eventId: number,
    token: string,
  ): Promise<LootSweepSummary> {
    return LootSweepSummarySchema.parse(
      await apiGet(`/events/${eventId}/loot-sweep/summary`, { internalToken: token }),
    );
  },

  /** Public team page: standings context, roster with contribution stats,
   * per-task progress, recent applied activity. */
  async eventTeam(eventId: number, teamId: number): Promise<EventTeamDetail> {
    return withFallback(
      async () =>
        EventTeamDetailSchema.parse(
          await apiGet(`/events/${eventId}/teams/${teamId}`, { revalidate: 15 }),
        ),
      () => mockEventTeam(eventId, teamId),
    );
  },

  /** Authed team read: same payload, but with the session cookie so members
   * of participating clans can view teams on draft (pre-publication) events.
   * Uncached (viewer-specific). */
  async eventTeamAuthed(eventId: number, teamId: number): Promise<EventTeamDetail> {
    return withFallback(
      async () =>
        EventTeamDetailSchema.parse(
          await apiGet(`/events/${eventId}/teams/${teamId}`, { authed: true }),
        ),
      () => mockEventTeam(eventId, teamId),
    );
  },

  /** Teams-tab standings rollup: rank/score plus tasks-done, pot share,
   * event-window loot GP, top task-credited items, and top contributors per
   * team — one self-sufficient payload. Cached. */
  async eventTeams(eventId: number): Promise<EventTeamsResponse> {
    return withFallback(
      async () =>
        EventTeamsResponseSchema.parse(
          await apiGet(`/events/${eventId}/teams`, { revalidate: 15 }),
        ),
      () => mockEventTeams(eventId),
    );
  },

  /** Authed variant — session cookie so members can see the Teams tab on a
   * draft (pre-publication) event. Uncached (viewer-specific). */
  async eventTeamsAuthed(eventId: number): Promise<EventTeamsResponse> {
    return withFallback(
      async () =>
        EventTeamsResponseSchema.parse(
          await apiGet(`/events/${eventId}/teams`, { authed: true }),
        ),
      () => mockEventTeams(eventId),
    );
  },

  /** Event-wide player contribution leaderboard (Players tab), cached. */
  async eventPlayers(eventId: number): Promise<EventPlayersResponse> {
    return withFallback(
      async () =>
        EventPlayersResponseSchema.parse(
          await apiGet(`/events/${eventId}/players`, { revalidate: 15 }),
        ),
      () => mockEventPlayers(eventId),
    );
  },

  /** Authed variant — session cookie so members can see the Players tab on a
   * draft (pre-publication) event. Uncached (viewer-specific). */
  async eventPlayersAuthed(eventId: number): Promise<EventPlayersResponse> {
    return withFallback(
      async () =>
        EventPlayersResponseSchema.parse(
          await apiGet(`/events/${eventId}/players`, { authed: true }),
        ),
      () => mockEventPlayers(eventId),
    );
  },

  /** One player's full contribution drill-down (items + per-task + activity).
   * Authed (draft visibility); fetched on-demand when a row is expanded. */
  async eventPlayerDetail(eventId: number, playerId: number): Promise<EventPlayerDetail> {
    return withFallback(
      async () =>
        EventPlayerDetailSchema.parse(
          await apiGet(`/events/${eventId}/players/${playerId}`, { authed: true }),
        ),
      () => mockEventPlayerDetail(eventId, playerId),
    );
  },

  /** Per-(task, team) item-level breakdown: which requirements a team has
   * obtained vs still needs, plus who contributed. `teamId` selects the team;
   * omit to default to the viewer's own team (resolved server-side). Authed so
   * the viewer default + draft visibility work. Uncached (viewer-specific). */
  async taskBreakdown(
    eventId: number,
    taskId: number,
    teamId?: number,
  ): Promise<TaskBreakdown> {
    const q = teamId != null ? `?team_id=${teamId}` : "";
    return withFallback(
      async () =>
        TaskBreakdownSchema.parse(
          await apiGet(`/events/${eventId}/tasks/${taskId}/breakdown${q}`, { authed: true }),
        ),
      () => ({
        task_id: taskId,
        team_id: teamId ?? 0,
        team_name: null,
        type: "custom" as const,
        kind: null,
        progress: 0,
        target: 1,
        completed: false,
        wildcard: 0,
        structure: "meter" as const,
        meter: { progress: 0, target: 1, unit: "", binary: false, label: null, target_value: null },
        contributors: [],
      }),
    );
  },

  /** Authed event read: includes the viewer block and, for event admins, the
   * join code. Uncached (viewer-specific). */
  async eventForAdmin(id: number): Promise<EventDetail> {
    return withFallback(
      async () => EventDetailSchema.parse(await apiGet(`/events/${id}`, { authed: true })),
      () => mockEvent(id),
    );
  },

  async createEvent(input: EventInput): Promise<{ id: number }> {
    return withFallback(
      async () => (await apiSend("POST", `/events`, input)) as { id: number },
      () => ({ id: Math.floor(100 + Math.random() * 900) }),
    );
  },

  /** Event kinds for the create form: every registry row, each annotated
   * with `creatable` for the current viewer + group (web43a). */
  async eventKinds(groupId: number | null): Promise<EventKindMeta[]> {
    const qs = groupId != null ? `?group_id=${groupId}` : "";
    return withFallback(
      async () =>
        EventKindMetaSchema.array().parse(
          await apiGet(`/events/meta/types${qs}`, { authed: true }),
        ),
      () => [
        { key: "standard", label: "Standard", description: null, enabled: true, admin_only: false, creatable: true },
        { key: "bingo", label: "Bingo", description: null, enabled: true, admin_only: false, creatable: true },
        { key: "board_game", label: "Board game", description: null, enabled: true, admin_only: true, creatable: false },
      ],
    );
  },

  async updateEvent(
    eventId: number,
    patch: Partial<
      Pick<
        EventInput,
        | "name"
        | "description"
        | "starts_at"
        | "ends_at"
        | "formation_mode"
        | "join_code"
        | "requires_confirmation"
        | "submission_policy"
        | "bonus_line_points"
        | "bonus_blackout_points"
        | "mode"
        | "kind"
        | "visibility"
      >
    > & {
      /** Team-leadership knobs (web48a); partial objects merge server-side. */
      leadership?: {
        enabled?: boolean;
        co_leaders?: boolean;
        selection?: "admin" | "election";
      };
    },
  ): Promise<EventDetail> {
    return withFallback(
      async () => EventDetailSchema.parse(await apiSend("PATCH", `/events/${eventId}`, patch)),
      () => mockEvent(eventId),
    );
  },

  // --- Team leadership (web48a) ------------------------------------------------
  /** Assign a team's leader or co-leader (event admin; a leader may appoint
   * their own co-leader). */
  async setTeamLeadership(
    eventId: number,
    teamId: number,
    playerId: number,
    role: "leader" | "co_leader",
  ): Promise<void> {
    await apiSend("PUT", `/events/${eventId}/teams/${teamId}/leadership`, {
      player_id: playerId,
      role,
    });
  },

  /** Remove a leadership role (admin, the leader for a co-leader, or the
   * holder stepping down). */
  async clearTeamLeadership(eventId: number, teamId: number, playerId: number): Promise<void> {
    await apiSend("DELETE", `/events/${eventId}/teams/${teamId}/leadership/${playerId}`, {});
  },

  /** Cast/replace the viewer's vote for their team's leader (election mode). */
  async castLeaderVote(
    eventId: number,
    teamId: number,
    candidatePlayerId: number,
  ): Promise<{ leader_player_id: number | null }> {
    const res = (await apiSend("POST", `/events/${eventId}/teams/${teamId}/leader-vote`, {
      candidate_player_id: candidatePlayerId,
    })) as { leader_player_id?: number | null };
    return { leader_player_id: res?.leader_player_id ?? null };
  },

  // --- Event lifecycle (Task 21) ---------------------------------------------
  /** Explicit activation (draft -> active). 422 when the event isn't ready
   * (no teams / incomplete bingo board / end date in the past); 409 at the
   * tier's active-event limit. Returns the refreshed detail. */
  async activateEvent(eventId: number): Promise<EventDetail> {
    return withFallback(
      async () => EventDetailSchema.parse(await apiSend("POST", `/events/${eventId}/activate`, {})),
      () => ({ ...mockEvent(eventId), status: "active" as const }),
    );
  },

  /** Pre-flight the activation checks without activating — powers the manager's
   * "Check readiness" button. Read-only. */
  async eventReadiness(eventId: number): Promise<EventReadiness> {
    return withFallback(
      async () => EventReadinessSchema.parse(await apiGet(`/events/${eventId}/readiness`, { authed: true })),
      () => ({ status: "draft", ready: true, blockers: [], starts_at: null, auto_start: false, already_active: false }),
    );
  },

  /** Explicit end (active -> past). Final standings are announced to Discord. */
  async endEvent(eventId: number): Promise<EventDetail> {
    return withFallback(
      async () => EventDetailSchema.parse(await apiSend("POST", `/events/${eventId}/end`, {})),
      () => ({ ...mockEvent(eventId), status: "past" as const }),
    );
  },

  // --- Prize pot: buy-ins & donations (web52a) -----------------------------
  /** The event's prize pot: totals, config, per-team breakdown and (unless
   * redacted) the contributor list. Public read; admins get every row + notes. */
  async eventPot(eventId: number): Promise<EventPrizePot> {
    const zero = { value: 0, value_formatted: "0" };
    return withFallback(
      async () => EventPrizePotSchema.parse(await apiGet(`/events/${eventId}/pot`, { authed: true })),
      () => ({
        enabled: false,
        total: zero,
        buyin_total: zero,
        donation_total: zero,
        config: {
          default_buyin: zero,
          distribution: "first_only" as const,
          top_n: 1,
          splits: [100],
          advertise: false,
          show_contributors: true,
          allow_leader_mark: false,
        },
        per_team: [],
        contributors: [],
        can_manage: false,
      }),
    );
  },

  /** Record a buy-in or donation. Buy-ins default `pledged`; donations `paid`. */
  async recordBuyin(
    eventId: number,
    input: {
      player_id?: number | null;
      rsn?: string | null;
      team_id?: number | null;
      kind?: EventBuyinKind;
      amount: number;
      status?: "pledged" | "paid";
      note?: string | null;
    },
  ): Promise<{ id: number }> {
    return withFallback(
      async () => (await apiSend("POST", `/events/${eventId}/buyins`, input)) as { id: number },
      () => ({ id: 0 }),
    );
  },

  /** Edit a buy-in's amount / note or flip its paid state (the roster "tick"). */
  async updateBuyin(
    eventId: number,
    buyinId: number,
    patch: { amount?: number; status?: EventBuyinStatus; note?: string | null },
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("PATCH", `/events/${eventId}/buyins/${buyinId}`, patch);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  /** Remove a buy-in — soft-void once it was ever paid, else a hard delete. */
  async deleteBuyin(eventId: number, buyinId: number): Promise<{ ok: true; voided: boolean }> {
    return withFallback(
      async () =>
        (await apiSend("DELETE", `/events/${eventId}/buyins/${buyinId}`, {})) as {
          ok: true;
          voided: boolean;
        },
      () => ({ ok: true, voided: false }),
    );
  },

  /** Seed one pledged buy-in per member at the default buy-in (a ready
   * checklist). Optionally scoped to one team. Skips members already seeded. */
  async bulkSeedBuyins(eventId: number, teamId?: number | null): Promise<{ created: number }> {
    return withFallback(
      async () =>
        (await apiSend(
          "POST",
          `/events/${eventId}/buyins/bulk`,
          teamId != null ? { team_id: teamId } : {},
        )) as { created: number },
      () => ({ created: 0 }),
    );
  },

  /** Post the current pot to the event's Discord announcements channel now. */
  async announcePot(eventId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/pot/announce`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  /** Toggle the pot and/or merge its config (writes to PATCH /events/{id}).
   * Disabling an event that has recorded buy-ins throws ApiError 409 (problem
   * `type: "buyins-present"` with `count`/`total`) unless `confirm_disable_buyins`
   * is set — the caller catches it to show a confirm dialog, then retries. */
  async updateEventPotConfig(
    eventId: number,
    input: {
      buyins_enabled?: boolean;
      confirm_disable_buyins?: boolean;
      prize_config?: {
        default_buyin?: number;
        distribution?: EventPrizeDistribution;
        top_n?: number;
        splits?: number[];
        advertise?: boolean;
        show_contributors?: boolean;
        allow_leader_mark?: boolean;
      };
    },
  ): Promise<EventDetail> {
    return withFallback(
      async () => EventDetailSchema.parse(await apiSend("PATCH", `/events/${eventId}`, input)),
      () => mockEvent(eventId),
    );
  },

  /** Permanently delete a draft or ended event and everything scoped to it.
   * The backend requires `confirm_name` to exactly match the event's name
   * (422 otherwise) and refuses to delete a live event (409 — end it first). */
  async deleteEvent(eventId: number, confirmName: string): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/events/${eventId}`, { confirm_name: confirmName });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  // --- Bingo designer (Task 20) ---------------------------------------------
  /** Replace the event's whole bingo board. 409 once the event has started. */
  async saveEventBingo(eventId: number, input: BingoBoardInput): Promise<BingoBoard> {
    return withFallback(
      async () => BingoBoardSchema.parse(await apiSend("PUT", `/events/${eventId}/bingo`, input)),
      () => ({
        size: input.size,
        cells: input.cells
          .slice()
          .sort((a, b) => a.idx - b.idx)
          .map((c) => ({
            index: c.idx,
            label: c.label ?? c.new_task?.label ?? "Free space",
            task_id: c.task_id ?? null,
            completed_by: [],
            completions: [],
          })),
      }),
    );
  },

  // --- Board game (web44a) ----------------------------------------------------
  /** The whole board: tiles + settings + team positions (game view + designer). */
  async eventBoard(eventId: number): Promise<BoardDetail> {
    return BoardDetailSchema.parse(await apiGet(`/events/${eventId}/board`, { authed: true }));
  },

  /** Loot Sweep live board: every `loot_sweep` set with per-team, per-item
   * receipt counts + decayed points + set-bonus status. `authed` forwards the
   * session when present (to see restricted events) and tolerates anonymous. */
  async eventLootSweep(eventId: number): Promise<LootSweepBoard> {
    return withFallback(
      async () =>
        LootSweepBoardSchema.parse(await apiGet(`/events/${eventId}/loot-sweep`, { authed: true })),
      () => mockEventLootSweep(eventId),
    );
  },

  /** Loot Sweep hover card: per-team receipt ledger (who/when/points/proof)
   * for ONE item of a set. Fetched lazily the first time a cell's card opens. */
  async eventLootSweepReceipts(
    eventId: number,
    taskId: number,
    item: string,
  ): Promise<LootSweepReceipts> {
    const q = new URLSearchParams({ task_id: String(taskId), item });
    return withFallback(
      async () =>
        LootSweepReceiptsSchema.parse(
          await apiGet(`/events/${eventId}/loot-sweep/receipts?${q}`, { authed: true }),
        ),
      () => mockEventLootSweepReceipts(eventId, taskId, item),
    );
  },

  /** Public completion timeline (loot_sweep + every kind). Forwards the session
   * when present so admins see hidden tasks / the real RSN behind masked rows. */
  async eventCompletionHistory(
    eventId: number,
    params: { page?: number; teamId?: number; taskId?: number; player?: string } = {},
  ): Promise<CompletionHistory> {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.teamId) q.set("teamId", String(params.teamId));
    if (params.taskId) q.set("taskId", String(params.taskId));
    if (params.player) q.set("player", params.player);
    return withFallback(
      async () =>
        CompletionHistorySchema.parse(
          await apiGet(`/events/${eventId}/completions/history?${q}`, { authed: true }),
        ),
      () => ({
        event_id: eventId,
        kind: "standard",
        is_admin: false,
        entries: [],
        meta: { page: 1, limit: 50, total: 0 },
      }),
    );
  },

  /** Event-scoped manager audit log: merged ledger + admin actions. Admin only. */
  async eventAudit(eventId: number, params: EventAuditParams = {}): Promise<EventAudit> {
    const p = new URLSearchParams();
    if (params.page) p.set("page", String(params.page));
    if (params.limit) p.set("limit", String(params.limit));
    if (params.category?.length) p.set("category", params.category.join(","));
    if (params.actorUserId) p.set("actor_user_id", String(params.actorUserId));
    if (params.playerId) p.set("player_id", String(params.playerId));
    if (params.teamId) p.set("team_id", String(params.teamId));
    if (params.taskId) p.set("task_id", String(params.taskId));
    if (params.sourceType) p.set("source_type", params.sourceType);
    if (params.hasProof) p.set("has_proof", "1");
    if (params.from) p.set("from", String(params.from));
    if (params.to) p.set("to", String(params.to));
    if (params.q) p.set("q", params.q);
    return withFallback(
      async () =>
        EventAuditSchema.parse(await apiGet(`/events/${eventId}/audit?${p}`, { authed: true })),
      () => ({
        event_id: eventId,
        entries: [],
        meta: { page: 1, limit: 50, total: 0, capped: false },
      }),
    );
  },

  /** Replace the tile layout (designer autosave). 409 once the event starts. */
  async saveEventBoard(eventId: number, input: BoardInput): Promise<BoardDetail> {
    return BoardDetailSchema.parse(await apiSend("PUT", `/events/${eventId}/board`, input));
  },

  /** Procedurally generate a whole board (art + sequential tile track) in one
   * shot. Draft-only. Returns the refreshed board (extra `generated` meta is
   * ignored by BoardDetailSchema). */
  async generateEventBoard(
    eventId: number,
    params: {
      seed?: number | null;
      regions?: number;
      tiles?: number;
      style?: "path" | "filled";
      title?: string;
      subtitle?: string;
      watermark?: string | null;
    },
  ): Promise<BoardDetail> {
    return BoardDetailSchema.parse(
      await apiSend("POST", `/events/${eventId}/board/generate`, params),
    );
  },

  /** Merge a partial board-settings document (live-tunable mid-event). */
  async patchEventBoardSettings(
    eventId: number,
    patch: Record<string, unknown>,
  ): Promise<BoardSettings> {
    const res = z
      .object({ settings: BoardSettingsSchema })
      .parse(await apiSend("PATCH", `/events/${eventId}/board/settings`, patch));
    return res.settings;
  },

  /** Upload the board background image (server-side B2 put). */
  async uploadEventBoardBackground(
    eventId: number,
    form: FormData,
  ): Promise<{ background_url: string; bg_width: number; bg_height: number }> {
    return z
      .object({
        background_url: z.string(),
        bg_width: z.number().int(),
        bg_height: z.number().int(),
      })
      .parse(await apiSendForm("POST", `/events/${eventId}/board/background`, form));
  },

  /** Upload a custom boss/category image for a Loot Sweep group; returns the
   * stored URL to put in the group's `image_url`. */
  async uploadLootSweepImage(eventId: number, form: FormData): Promise<{ url: string }> {
    return z
      .object({ url: z.string(), width: z.number().int(), height: z.number().int() })
      .parse(await apiSendForm("POST", `/events/${eventId}/loot-sweep/image`, form));
  },

  /** Manual dice roll for the caller's team (admins may pass a team_id). */
  async rollEventBoard(eventId: number, teamId?: number): Promise<BoardRollResult> {
    return BoardRollResultSchema.parse(
      await apiSend("POST", `/events/${eventId}/board/roll`, teamId ? { team_id: teamId } : {}),
    );
  },

  /** The event's shop catalog + (when on a team) wallet/inventory/cooldowns. */
  async eventBoardShop(eventId: number, teamId?: number): Promise<BoardShopState> {
    const qs = teamId != null ? `?team_id=${teamId}` : "";
    return BoardShopStateSchema.parse(
      await apiGet(`/events/${eventId}/board/shop${qs}`, { authed: true }),
    );
  },

  /** Buy a power-up with team coins. */
  async buyEventBoardItem(
    eventId: number,
    shopItemId: number,
    teamId?: number,
  ): Promise<{ team_id: number; inventory_id: number; coins: number }> {
    return z
      .object({ team_id: z.number().int(), inventory_id: z.number().int(), coins: z.number().int() })
      .parse(
        await apiSend("POST", `/events/${eventId}/board/shop/buy`, {
          shop_item_id: shopItemId,
          ...(teamId != null ? { team_id: teamId } : {}),
        }),
      );
  },

  /** Use an owned power-up (skip / reroll / boost…). `value` drives numeric
   * effects like choose_roll (Wizard's Mind Bomb); `targetTeamId` the offensive
   * ones (steal/reroll_opponent/knockback/freeze); `targetTileIdx` the roadblock
   * (optional — the backend defaults it to the team's current tile). */
  async useEventBoardItem(
    eventId: number,
    inventoryId: number,
    opts: {
      teamId?: number;
      targetTeamId?: number;
      targetTileIdx?: number;
      value?: number;
    } = {},
  ): Promise<Record<string, unknown>> {
    return (await apiSend("POST", `/events/${eventId}/board/items/${inventoryId}/use`, {
      ...(opts.teamId != null ? { team_id: opts.teamId } : {}),
      ...(opts.targetTeamId != null ? { target_team_id: opts.targetTeamId } : {}),
      ...(opts.targetTileIdx != null ? { target_tile_idx: opts.targetTileIdx } : {}),
      ...(opts.value != null ? { value: opts.value } : {}),
    })) as Record<string, unknown>;
  },

  /** Resolve a pending task choice (choose_task items — Cache of Runes). */
  async resolveEventBoardChoice(
    eventId: number,
    choiceIndex: number,
  ): Promise<Record<string, unknown>> {
    return (await apiSend("POST", `/events/${eventId}/board/choice`, {
      choice_index: choiceIndex,
    })) as Record<string, unknown>;
  },

  /** Per-event shop config: refresh cadence (mirrored from settings.shop) plus
   * a row per active catalog item with its overrides. */
  async eventBoardShopConfig(eventId: number): Promise<BoardShopConfig> {
    return BoardShopConfigSchema.parse(
      await apiGet(`/events/${eventId}/board/shop/config`, { authed: true }),
    );
  },

  /** Save the per-event shop config (per-item overrides). Refresh cadence is
   * saved separately through patchEventBoardSettings. */
  async putEventBoardShopConfig(
    eventId: number,
    payload: BoardShopConfigInput,
  ): Promise<BoardShopConfig> {
    return BoardShopConfigSchema.parse(
      await apiSend("PUT", `/events/${eventId}/board/shop/config`, payload),
    );
  },

  /** Superadmin: the site-wide power-up catalog. */
  async adminShopItems(): Promise<AdminShopItem[]> {
    return AdminShopItemSchema.array().parse(
      await apiGet(`/admin/boardgame-shop`, { authed: true }),
    );
  },

  /** Superadmin: edit one catalog row. */
  async adminPatchShopItem(
    itemId: number,
    patch: Record<string, unknown>,
  ): Promise<AdminShopItem> {
    return AdminShopItemSchema.parse(
      await apiSend("PATCH", `/admin/boardgame-shop/${itemId}`, patch),
    );
  },

  /** Curated task presets for the designer picker (any group admin). */
  async eventTaskLibrary(
    params: { query?: string; type?: string; page?: number } = {},
  ): Promise<EventTaskLibraryItem[]> {
    const q = new URLSearchParams();
    if (params.query) q.set("query", params.query);
    if (params.type) q.set("type", params.type);
    if (params.page) q.set("page", String(params.page));
    return withFallback(
      async () =>
        EventTaskLibraryItemSchema.array().parse(
          await apiGet(`/event-task-library?${q}`, { authed: true }),
        ),
      () => mockEventTaskLibrary(params.query, params.type),
    );
  },

  // --- Task-library management (superadmin CP) ------------------------------
  /** Create a curated site-wide preset (source "curated", group_id null). */
  async adminCreateEventTaskLibraryItem(
    input: EventTaskLibraryItemInput,
  ): Promise<EventTaskLibraryItem> {
    return withFallback(
      async () =>
        EventTaskLibraryItemSchema.parse(await apiSend("POST", `/event-task-library`, input)),
      () => ({
        id: Math.floor(Math.random() * 100000),
        name: input.name,
        description: input.description ?? null,
        type: input.type,
        target: input.target ?? null,
        target_value: input.target_value ?? null,
        default_points: input.default_points ?? 0,
        difficulty: input.difficulty ?? null,
        config: input.config ?? null,
        source: "curated",
        group_id: null,
        visibility: input.visibility ?? "public",
      }),
    );
  },

  /** Edit any preset (curated or group-saved); absent keys stay unchanged. */
  async adminUpdateEventTaskLibraryItem(
    itemId: number,
    patch: EventTaskLibraryItemPatch,
  ): Promise<EventTaskLibraryItem> {
    return EventTaskLibraryItemSchema.parse(
      await apiSend("PATCH", `/event-task-library/${itemId}`, patch),
    );
  },

  /** Soft-delete a preset (tasks already copied into events are untouched). */
  async adminDeleteEventTaskLibraryItem(itemId: number): Promise<{ ok: true }> {
    await apiSend("DELETE", `/event-task-library/${itemId}`, {});
    return { ok: true } as const;
  },

  // --- Event templates (save/rerun events) ----------------------------------
  /** Snapshot an event's structure as a reusable template (any lifecycle
   * state). Upserts per owning group by lower-cased name. */
  async saveEventTemplate(eventId: number, input: EventTemplateSaveInput): Promise<{ id: number }> {
    return withFallback(
      async () =>
        (await apiSend("POST", `/events/${eventId}/save-template`, input)) as { id: number },
      () => ({ id: Math.floor(Math.random() * 100000) }),
    );
  },

  /** Templates visible to the caller: public ∪ own groups' private rows.
   * `groupId` narrows to that group's own templates (management view). */
  async eventTemplates(
    params: { query?: string; groupId?: number; page?: number } = {},
  ): Promise<EventTemplateSummary[]> {
    const q = new URLSearchParams();
    if (params.query) q.set("query", params.query);
    if (params.groupId != null) q.set("groupId", String(params.groupId));
    if (params.page) q.set("page", String(params.page));
    return withFallback(
      async () =>
        EventTemplateSummarySchema.array().parse(
          await apiGet(`/event-templates?${q}`, { authed: true }),
        ),
      () => mockEventTemplates(params.query),
    );
  },

  /** Template detail + preview (task list, team names) for the picker. */
  async eventTemplate(templateId: number): Promise<EventTemplateDetail> {
    return withFallback(
      async () =>
        EventTemplateDetailSchema.parse(
          await apiGet(`/event-templates/${templateId}`, { authed: true }),
        ),
      () => mockEventTemplateDetail(templateId),
    );
  },

  /** Create a fresh draft event from a template. Tasks that no longer
   * validate come back in `skipped_tasks` (their cells survive unbound). */
  async instantiateEventTemplate(
    templateId: number,
    input: EventTemplateInstantiateInput,
  ): Promise<EventTemplateInstantiateResult> {
    return withFallback(
      async () =>
        EventTemplateInstantiateResultSchema.parse(
          await apiSend("POST", `/event-templates/${templateId}/instantiate`, input),
        ),
      () => ({ id: Math.floor(Math.random() * 100000), skipped_tasks: [] }),
    );
  },

  /** Rename / re-describe / re-scope a template. */
  async updateEventTemplate(templateId: number, patch: EventTemplatePatch): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("PATCH", `/event-templates/${templateId}`, patch);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  /** Soft-delete a template (instantiated events are untouched). */
  async deleteEventTemplate(templateId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/event-templates/${templateId}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  /** Item-name autocomplete for the task form (exact in-game names). */
  async searchEventItems(query: string): Promise<EventMetaEntry[]> {
    return withFallback(
      async () =>
        EventMetaEntrySchema.array().parse(
          await apiGet(`/events/meta/items?q=${encodeURIComponent(query)}`, { authed: true }),
        ),
      () => [],
    );
  },

  /** Batch exact-name → game-id lookup (icon hydration for stored task
   * lists; names never contain pipes, so `|` is the separator). Unknown
   * names are simply absent from the response. */
  async resolveEventMeta(kind: "item" | "npc", names: string[]): Promise<EventMetaEntry[]> {
    if (!names.length) return [];
    const q = new URLSearchParams({ kind, names: names.slice(0, 100).join("|") });
    return withFallback(
      async () =>
        EventMetaEntrySchema.array().parse(
          await apiGet(`/events/meta/resolve?${q}`, { authed: true }),
        ),
      () => [],
    );
  },

  /** NPC-name autocomplete for the task form (exact in-game names). */
  async searchEventNpcs(query: string): Promise<EventMetaEntry[]> {
    return withFallback(
      async () =>
        EventMetaEntrySchema.array().parse(
          await apiGet(`/events/meta/npcs?q=${encodeURIComponent(query)}`, { authed: true }),
        ),
      () => [],
    );
  },

  /** Pet-name autocomplete for the task form — names from the pet taxonomy
   * (guaranteed to validate as pets), ids from the item DB for icons. */
  async searchEventPets(query: string): Promise<EventMetaEntry[]> {
    return withFallback(
      async () =>
        EventMetaEntrySchema.array().parse(
          await apiGet(`/events/meta/pets?q=${encodeURIComponent(query)}`, { authed: true }),
        ),
      () => [],
    );
  },

  /** Full pet taxonomy (every category with its member pets) — backs the
   * task form's category presets for the customizable pet list. */
  async eventPetCategories(): Promise<EventPetCategory[]> {
    return withFallback(
      async () =>
        EventPetCategorySchema.array().parse(
          await apiGet(`/events/meta/pet-categories`, { authed: true }),
        ),
      () => [],
    );
  },

  /** Items on one NPC's drop table — the task form's "import a boss's drops"
   * helper (wiki table → boss-family fallback → observed tracked drops). */
  async eventNpcDropItems(npcId: number): Promise<EventMetaEntry[]> {
    return withFallback(
      async () =>
        EventMetaEntrySchema.array().parse(
          await apiGet(`/events/meta/npc-drops?npc_id=${npcId}`, { authed: true }),
        ),
      () => [],
    );
  },

  /** NPC drop sources for one or more items — backs the task-form
   * "restrict to specific NPC sources" picker (names are |-separated exact
   * in-game names, no pipes). Unresolved names are simply absent. */
  async itemSources(names: string[]): Promise<EventItemSources> {
    if (!names.length) return [];
    const q = new URLSearchParams({ items: names.slice(0, 50).join("|") });
    return withFallback(
      async () =>
        EventItemSourcesSchema.parse(
          await apiGet(`/events/meta/item-sources?${q}`, { authed: true }),
        ),
      () => [],
    );
  },

  /** `visibility` echoes what the library actually stored — a "public" save
   * whose requirements duplicate an existing public preset comes back
   * "private" (group-only). */
  async addEventTask(
    eventId: number,
    input: EventTaskInput,
  ): Promise<{ id: number; visibility?: "public" | "private" }> {
    return withFallback(
      async () =>
        (await apiSend("POST", `/events/${eventId}/tasks`, input)) as {
          id: number;
          visibility?: "public" | "private";
        },
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

  async updateEventTeam(
    eventId: number,
    teamId: number,
    patch: EventTeamPatch,
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("PATCH", `/events/${eventId}/teams/${teamId}`, patch);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  async deleteEventTeam(eventId: number, teamId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/events/${eventId}/teams/${teamId}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  // --- Event verification queue & manual actions (Task 18) -----------------
  async updateEventTask(
    eventId: number,
    taskId: number,
    patch: EventTaskPatch,
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("PATCH", `/events/${eventId}/tasks/${taskId}`, patch);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  /** Admin-only ledger read (verification queue + full history). */
  async eventCompletions(
    eventId: number,
    params: { status?: string; teamId?: number; taskId?: number } = {},
  ): Promise<EventCompletion[]> {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.teamId) q.set("teamId", String(params.teamId));
    if (params.taskId) q.set("taskId", String(params.taskId));
    return withFallback(
      async () =>
        EventCompletionSchema.array().parse(
          await apiGet(`/events/${eventId}/completions?${q}`, { authed: true }),
        ),
      () => mockEventCompletions(eventId, params.status),
    );
  },

  async confirmEventCompletion(eventId: number, completionId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/completions/${completionId}/confirm`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  async rejectEventCompletion(
    eventId: number,
    completionId: number,
    note?: string,
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend(
          "POST",
          `/events/${eventId}/completions/${completionId}/reject`,
          note ? { note } : {},
        );
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  async awardEventCompletion(eventId: number, input: EventAwardInput): Promise<{ id: number }> {
    return withFallback(
      async () => (await apiSend("POST", `/events/${eventId}/award`, input)) as { id: number },
      () => ({ id: Math.floor(Math.random() * 100000) }),
    );
  },

  async revokeEventCompletion(eventId: number, input: EventRevokeInput): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/revoke`, input);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  // --- Event membership (Task 16) ------------------------------------------
  async joinEvent(eventId: number, input: EventJoinInput): Promise<EventJoinResult> {
    return withFallback(
      async () => EventJoinResultSchema.parse(await apiSend("POST", `/events/${eventId}/join`, input)),
      () => ({ team_id: input.team_id ?? 21, pooled: false }),
    );
  },

  async leaveEvent(eventId: number, playerId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/leave`, { player_id: playerId });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  async addEventTeamMember(
    eventId: number,
    teamId: number,
    playerId: number,
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/teams/${teamId}/members`, {
          player_id: playerId,
        });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  /** Bulk roster add from a pasted list of RSNs; returns per-name outcomes. */
  async bulkAddEventTeamMembers(
    eventId: number,
    teamId: number,
    names: string[],
  ): Promise<EventTeamBulkAddResult> {
    return withFallback(
      async () =>
        EventTeamBulkAddResultSchema.parse(
          await apiSend("POST", `/events/${eventId}/teams/${teamId}/members/bulk`, { names }),
        ),
      () => ({
        added: names.map((name, i) => ({ id: 9000 + i, name })),
        skipped: [],
      }),
    );
  },

  async removeEventTeamMember(
    eventId: number,
    teamId: number,
    playerId: number,
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/events/${eventId}/teams/${teamId}/members/${playerId}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  // --- Clan-vs-clan participants (Plan B) ------------------------------------
  async eventParticipants(eventId: number): Promise<EventParticipant[]> {
    return withFallback(
      async () =>
        EventParticipantSchema.array().parse(
          await apiGet(`/events/${eventId}/participants`, { authed: true }),
        ),
      () => [],
    );
  },

  async inviteEventParticipant(eventId: number, groupId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/participants`, { group_id: groupId });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  /** Invite several opponent clans at once (the many-clan case). Returns the
   * per-clan outcome so the UI can report exactly who was invited vs skipped. */
  async bulkInviteEventParticipants(
    eventId: number,
    groupIds: number[],
  ): Promise<{
    invited: { group_id: number; group_name: string | null }[];
    skipped: { group_id: number; group_name: string | null; reason: string }[];
  }> {
    const clan = z.object({ group_id: z.number(), group_name: z.string().nullable() });
    const schema = z.object({
      invited: clan.array(),
      skipped: clan.extend({ reason: z.string() }).array(),
    });
    return withFallback(
      async () =>
        schema.parse(
          await apiSend("POST", `/events/${eventId}/participants/bulk`, {
            group_ids: groupIds,
          }),
        ),
      () => ({ invited: [], skipped: [] }),
    );
  },

  async acceptEventInvitation(
    eventId: number,
    groupId: number,
    opts?: { createDiscordEvent?: boolean },
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/participants/${groupId}/accept`, {
          create_discord_event: Boolean(opts?.createDiscordEvent),
        });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  async declineEventInvitation(eventId: number, groupId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/participants/${groupId}/decline`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  async removeEventParticipant(eventId: number, groupId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/events/${eventId}/participants/${groupId}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  /** Pending invites for clans the caller administers. */
  async eventInvitations(): Promise<EventInvitation[]> {
    return withFallback(
      async () =>
        EventInvitationSchema.array().parse(await apiGet(`/events/invitations`, { authed: true })),
      () => [],
    );
  },

  /** Clan-vs-clan events open to member opt-in that the caller hasn't joined. */
  async eventRecruiting(): Promise<EventRecruitingItem[]> {
    return withFallback(
      async () =>
        EventRecruitingItemSchema.array().parse(
          await apiGet(`/events/recruiting`, { authed: true }),
        ),
      () => [],
    );
  },

  // --- Sign-up pool (formation_mode === "signup_pool") ---------------------
  /** The event's sign-up pool, with each player's current placement (admin). */
  async eventSignups(eventId: number): Promise<EventSignup[]> {
    return withFallback(
      async () =>
        EventSignupSchema.array().parse(
          await apiGet(`/events/${eventId}/signups`, { authed: true }),
        ),
      () => [],
    );
  },

  /** Place one signed-up player onto a team (admin manual sort). */
  async assignEventSignup(eventId: number, playerId: number, teamId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/signups/assign`, {
          player_id: playerId,
          team_id: teamId,
        });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  /** Randomly (re)distribute the pool across teams; optional clan scope. */
  async randomizeEventSignups(
    eventId: number,
    groupId?: number,
  ): Promise<EventRandomizeResult> {
    return withFallback(
      async () =>
        EventRandomizeResultSchema.parse(
          await apiSend(
            "POST",
            `/events/${eventId}/signups/randomize`,
            groupId != null ? { group_id: groupId } : {},
          ),
        ),
      () => ({ assigned: 0, unassigned: 0 }),
    );
  },

  /** Admin scale/testing tool: bulk-fill teams with random active members. */
  async populateEventRandom(
    eventId: number,
    source: "group" | "global",
    count?: number,
  ): Promise<EventPopulateResult> {
    return withFallback(
      async () =>
        EventPopulateResultSchema.parse(
          await apiSend("POST", `/events/${eventId}/populate-random`, {
            source,
            ...(count != null ? { count } : {}),
          }),
        ),
      () => ({ added: 0, source, teams: [] }),
    );
  },

  /** Withdraw a player from the pool (admin). */
  async removeEventSignup(eventId: number, playerId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/events/${eventId}/signups/${playerId}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  /** Post an interactive "Sign up" button to the event's Discord channel. */
  async postEventSignupMessage(eventId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/signup-message`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  // --- Event Discord destinations (Task 19) --------------------------------
  /** The event's Discord destination config (admin-only). */
  async eventDiscord(eventId: number, groupId?: number | null): Promise<EventChannelConfig> {
    const suffix = groupId != null ? `?group_id=${groupId}` : "";
    return withFallback(
      async () =>
        EventChannelConfigSchema.parse(
          await apiGet(`/events/${eventId}/discord${suffix}`, { authed: true }),
        ),
      () => mockEventDiscord(eventId),
    );
  },

  /** Replace the event's Discord destination (guild + per-kind channels).
   * With `input.group_id`, writes that clan's own per-group scope (web48a). */
  async updateEventDiscord(
    eventId: number,
    input: EventChannelConfigInput,
  ): Promise<EventChannelConfig> {
    return withFallback(
      async () =>
        EventChannelConfigSchema.parse(await apiSend("PUT", `/events/${eventId}/discord`, input)),
      () => ({
        guild_id: input.guild_id,
        guild_name: null,
        channels: input.channels,
        discord_event_policy: input.discord_event_policy ?? "on_activate",
        pings: input.pings ?? {},
        // Mirror the backend PUT contract: absent = leave unchanged (defaults).
        messages: input.messages ?? mockEventDiscord(eventId).messages,
        per_group_discord: input.per_group_discord ?? false,
        group_id: input.group_id ?? null,
      }),
    );
  },

  /** Every guild the bot is in (bot-maintained Redis cache; never a live Discord call). */
  async eventDiscordGuilds(): Promise<EventDiscordGuildList> {
    return withFallback(
      async () =>
        (await apiGet(`/events/discord/guilds`, { authed: true })) as EventDiscordGuildList,
      () => mockEventDiscordGuilds(),
    );
  },

  /** Text channels of one guild (any guild the bot is in, not just group home guilds). */
  async eventDiscordChannels(guildId: string): Promise<EventDiscordChannelList> {
    return withFallback(
      async () =>
        (await apiGet(`/events/discord/guilds/${encodeURIComponent(guildId)}/channels`, {
          authed: true,
        })) as EventDiscordChannelList,
      () => mockEventDiscordChannels(guildId),
    );
  },

  /** Roles of one guild, for the event ping-role pickers (same bot cache
   * pipeline as the channel list; `stale: true` while the cache warms). */
  async eventDiscordRoles(guildId: string): Promise<GroupDiscordRoles> {
    return withFallback(
      async () =>
        GroupDiscordRolesSchema.parse(
          await apiGet(`/events/discord/guilds/${encodeURIComponent(guildId)}/roles`, {
            authed: true,
          }),
        ),
      () => ({ roles: [], stale: false }),
    );
  },

  /** Per-team Discord channels & roles config + live provisioning state
   * (web53a). `groupId` selects a participating clan's own scope. */
  async eventTeamDiscord(
    eventId: number,
    groupId?: number | null,
  ): Promise<EventTeamDiscordConfig> {
    const suffix = groupId != null ? `?group_id=${groupId}` : "";
    return withFallback(
      async () =>
        EventTeamDiscordConfigSchema.parse(
          await apiGet(`/events/${eventId}/team-discord${suffix}`, { authed: true }),
        ),
      () => mockEventTeamDiscord(eventId, groupId ?? null),
    );
  },

  /** Save one scope of the team-discord config; the bot provisions within
   * ~30s of the save. Absent keys leave stored values unchanged. */
  async updateEventTeamDiscord(
    eventId: number,
    input: EventTeamDiscordInput,
  ): Promise<EventTeamDiscordConfig> {
    return withFallback(
      async () =>
        EventTeamDiscordConfigSchema.parse(
          await apiSend("PUT", `/events/${eventId}/team-discord`, input),
        ),
      () => mockEventTeamDiscord(eventId, input.group_id ?? null),
    );
  },

  /** Current effective notification state for one team's channel (captain or
   * event admin — the modal seeds from this). */
  async teamNotifications(eventId: number, teamId: number): Promise<TeamNotifications> {
    return withFallback(
      async () =>
        TeamNotificationsSchema.parse(
          await apiGet(`/events/${eventId}/teams/${teamId}/notifications`, {
            authed: true,
          }),
        ),
      () => ({ team_id: teamId, toggles: {}, pings: {}, task_progress: "milestones" }),
    );
  },

  /** Captain/admin: tune which notifications one team's channel receives and
   * which of them mention @TeamRole. */
  async updateTeamNotifications(
    eventId: number,
    teamId: number,
    input: {
      toggles?: Record<string, boolean>;
      pings?: Record<string, boolean>;
      task_progress?: EventTaskProgressMode;
    },
  ): Promise<TeamNotifications> {
    return withFallback(
      async () =>
        TeamNotificationsSchema.parse(
          await apiSend("PUT", `/events/${eventId}/teams/${teamId}/notifications`, input),
        ),
      () => ({
        team_id: teamId,
        toggles: input.toggles ?? {},
        pings: input.pings ?? {},
        task_progress: input.task_progress ?? "milestones",
      }),
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

  /** Generate a custom-timeframe lootboard PNG (group-admin only). Errors
   * (invalid range, month still backfilling, cooldown) surface as ApiError
   * with a user-presentable message — deliberately no mock fallback. */
  async generateTimeframeBoard(
    groupId: number,
    startDate: string,
    endDate: string,
  ): Promise<{ url: string; start_date: string; end_date: string; source: string }> {
    const data = (await apiSend("POST", `/groups/${groupId}/lootboard/timeframe`, {
      start_date: startDate,
      end_date: endDate,
    })) as { url?: unknown; start_date?: unknown; end_date?: unknown; source?: unknown };
    if (!data || typeof data.url !== "string") {
      throw new ApiError(500, "Board generation returned no image URL.");
    }
    return {
      url: data.url,
      start_date: String(data.start_date ?? startDate),
      end_date: String(data.end_date ?? endDate),
      source: String(data.source ?? ""),
    };
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

  // --- Docs (CMS: superadmin-editable, replaces static .mdx files) -------
  async docs(): Promise<DocSummary[]> {
    return withFallback(
      async () => DocSummarySchema.array().parse(await apiGet(`/docs`, { revalidate: 60 })),
      () => [],
    );
  },

  async doc(slug: string): Promise<Doc | null> {
    try {
      return DocSchema.parse(await apiGet(`/docs/${encodeURIComponent(slug)}`, { revalidate: 60 }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      if (env.useMockApi) return null;
      throw err;
    }
  },

  async adminCreateDoc(input: DocInput): Promise<{ id: number }> {
    return withFallback(
      async () => (await apiSend("POST", `/admin/docs`, input)) as { id: number },
      () => ({ id: Math.floor(Math.random() * 100000) }),
    );
  },

  async adminUpdateDoc(slug: string, patch: Partial<DocInput>): Promise<Doc> {
    return withFallback(
      async () =>
        DocSchema.parse(await apiSend("PATCH", `/admin/docs/${encodeURIComponent(slug)}`, patch)),
      () => ({
        slug,
        title: patch.title ?? slug,
        description: patch.description ?? null,
        category: patch.category ?? "General",
        order: patch.order ?? 100,
        content: patch.content ?? "",
      }),
    );
  },

  async adminDeleteDoc(slug: string): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/admin/docs/${encodeURIComponent(slug)}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  // --- Redirects (admin-configurable, resolved at request time by middleware) --
  /** Enabled rules for the middleware read path (unauthed, cache-friendly). */
  async redirects(): Promise<RedirectRule[]> {
    return withFallback(
      async () => RedirectRuleSchema.array().parse(await apiGet(`/redirects`, { revalidate: 60 })),
      () => [],
    );
  },

  async adminRedirects(): Promise<Redirect[]> {
    return withFallback(
      async () => RedirectSchema.array().parse(await apiGet(`/admin/redirects`, { authed: true })),
      () => [],
    );
  },

  async adminCreateRedirect(input: RedirectInput): Promise<Redirect> {
    return RedirectSchema.parse(await apiSend("POST", `/admin/redirects`, input));
  },

  async adminUpdateRedirect(id: number, patch: Partial<RedirectInput>): Promise<Redirect> {
    return RedirectSchema.parse(await apiSend("PATCH", `/admin/redirects/${id}`, patch));
  },

  async adminDeleteRedirect(id: number): Promise<{ ok: true }> {
    await apiSend("DELETE", `/admin/redirects/${id}`, {});
    return { ok: true } as const;
  },

  // --- Item value overrides (post-submission valuation rules) -----------
  async itemValues(): Promise<PublicItemValue[]> {
    return withFallback(
      async () =>
        PublicItemValueSchema.array().parse(await apiGet(`/item-values`, { revalidate: 120 })),
      () => [],
    );
  },

  async adminItemValues(): Promise<ItemValueOverride[]> {
    return withFallback(
      async () =>
        ItemValueOverrideSchema.array().parse(await apiGet(`/admin/item-values`, { authed: true })),
      () => [],
    );
  },

  async adminItemSearch(q: string): Promise<ItemSearchResult[]> {
    return withFallback(
      async () =>
        ItemSearchResultSchema.array().parse(
          await apiGet(`/admin/item-values/item-search?q=${encodeURIComponent(q)}`, {
            authed: true,
          }),
        ),
      () => [],
    );
  },

  async adminItemValuesExport(): Promise<{ txt: string; count: number }> {
    return withFallback(
      async () =>
        (await apiGet(`/admin/item-values/export`, { authed: true })) as {
          txt: string;
          count: number;
        },
      () => ({ txt: "", count: 0 }),
    );
  },

  async adminCreateItemValue(input: ItemValueOverrideInput): Promise<{ id: number }> {
    return withFallback(
      async () => (await apiSend("POST", `/admin/item-values`, input)) as { id: number },
      () => ({ id: Math.floor(Math.random() * 100000) }),
    );
  },

  async adminUpdateItemValue(
    id: number,
    patch: Partial<ItemValueOverrideInput>,
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("PATCH", `/admin/item-values/${id}`, patch);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  async adminDeleteItemValue(id: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/admin/item-values/${id}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
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

  /** Which of the user's groups a Nitro boost on the DropTracker Discord
   * supports, plus the eligible groups and per-boost credit. */
  async myNitroBoost(): Promise<MyNitroBoost> {
    return withFallback(
      async () => MyNitroBoostSchema.parse(await apiGet(`/me/nitro-boost`, { authed: true })),
      () => ({
        per_boost_cents: 500,
        designated_group_id: null,
        effective_group_id: null,
        groups: [],
      }),
    );
  },

  /** Choose which group your Discord boost supports (null = auto-pick). */
  async setMyNitroBoost(groupId: number | null): Promise<MyNitroBoost> {
    return withFallback(
      async () =>
        MyNitroBoostSchema.parse(await apiSend("POST", `/me/nitro-boost`, { group_id: groupId })),
      () => ({
        per_boost_cents: 500,
        designated_group_id: groupId,
        effective_group_id: groupId,
        groups: [],
      }),
    );
  },

  /** Toggle one linked account's public visibility (players.hidden). */
  async setMyPlayerHidden(playerId: number, hidden: boolean): Promise<AccountSettings> {
    return withFallback(
      async () =>
        AccountSettingsSchema.parse(await apiSend("PATCH", `/me/players/${playerId}`, { hidden })),
      () => {
        const mock = mockAccountSettings();
        return {
          ...mock,
          players: mock.players.map((p) => (p.id === playerId ? { ...p, hidden } : p)),
        };
      },
    );
  },

  /** In-game event notification prefs for every linked account (types are
   * server-driven — new notification types appear without a UI change). */
  async notificationPrefs(): Promise<NotificationPrefs> {
    return withFallback(
      async () =>
        NotificationPrefsSchema.parse(await apiGet(`/me/notification-prefs`, { authed: true })),
      () => ({ types: [], players: [] }),
    );
  },

  /** Replace one linked account's in-game notification prefs. */
  async setPlayerNotificationPrefs(
    playerId: number,
    prefs: Record<string, boolean>,
  ): Promise<NotificationPrefs> {
    return withFallback(
      async () =>
        NotificationPrefsSchema.parse(
          await apiSend("PUT", `/me/players/${playerId}/notification-prefs`, { prefs }),
        ),
      () => ({ types: [], players: [] }),
    );
  },

  async search(q: string): Promise<SearchResults> {
    if (!q.trim()) return { players: [], groups: [], npcs: [], items: [] };
    return withFallback(
      async () =>
        SearchResultsSchema.parse(
          await apiGet(`/search?q=${encodeURIComponent(q)}`, { revalidate: 10 }),
        ),
      () => mockSearch(q),
    );
  },

  /**
   * Recent drop-feed history — the same Redis-backed list the live ticker
   * hydrates from via `/api/feed/recent`. Used server-side for decorative
   * surfaces (homepage hero collage); callers should treat it as best-effort.
   */
  async recentFeed(): Promise<FeedEvent[]> {
    return withFallback(
      async () => FeedEventSchema.array().parse(await apiGet(`/feed/recent`, { revalidate: 60 })),
      () => [],
    );
  },

  /**
   * Paid subscriber groups + individual supporters for the homepage
   * appreciation wall. Public, cached; decorative — callers treat it as
   * best-effort (an empty result just hides the section).
   */
  async supporters(): Promise<Supporters> {
    return withFallback(
      async () => SupportersSchema.parse(await apiGet(`/supporters`, { revalidate: 300 })),
      () => mockSupporters(),
    );
  },

  // --- Personal-best leaderboards -----------------------------------------
  /** Boss index for the PB leaderboards (optionally scoped to one group). */
  async pbBosses(groupId?: number): Promise<PbBossIndex> {
    const q = groupId != null ? `?group_id=${groupId}` : "";
    return withFallback(
      async () =>
        PbBossIndexSchema.parse(await apiGet(`/personal-bests/bosses${q}`, { revalidate: 120 })),
      () => mockPbBosses(groupId),
    );
  },

  /** Every team-size board for one boss (optionally scoped to one group). */
  async pbBoard(npcId: number, groupId?: number): Promise<PbBossBoard | null> {
    const q = groupId != null ? `&group_id=${groupId}` : "";
    return withFallback(
      async () =>
        PbBossBoardSchema.parse(
          await apiGet(`/personal-bests/board?npc_id=${npcId}${q}`, { revalidate: 120 }),
        ),
      () => mockPbBoard(npcId, groupId),
    ).catch(() => null); // 404 = no ranked times for this boss
  },

  // --- NPC / item pages -----------------------------------------------------
  /** NPC overview: lifetime + month totals, top players, recent drops. */
  async npcDetail(npcId: number): Promise<NpcDetail | null> {
    return withFallback(
      async () => NpcDetailSchema.parse(await apiGet(`/npcs/${npcId}`, { revalidate: 60 })),
      () => mockNpcDetail(npcId),
    ).catch(() => null); // 404 = unknown NPC
  },

  /** Wiki drop table for one NPC, with most-recent receiver per item. */
  async npcDropTable(npcId: number): Promise<NpcDropTable | null> {
    return withFallback(
      async () =>
        // Short revalidate so "building" registries surface quickly once warm.
        NpcDropTableSchema.parse(await apiGet(`/npcs/${npcId}/drop-table`, { revalidate: 30 })),
      () => mockNpcDropTable(npcId),
    ).catch(() => null); // 404 = unknown NPC (a known NPC with no table returns items: [])
  },

  /** Item overview: totals, GE value, recent/top receivers, drop sources. */
  async itemDetail(itemId: number): Promise<ItemDetail | null> {
    return withFallback(
      async () => ItemDetailSchema.parse(await apiGet(`/items/${itemId}`, { revalidate: 60 })),
      () => mockItemDetail(itemId),
    ).catch(() => null); // 404 = unknown item
  },

  /**
   * Resolve a nice-URL slug (`/groups/awesome-clan`) to its entity, or — when a
   * group/player name is shared — to a candidate list for a disambiguation page.
   * NPC/item duplicate names collapse to the primary id. See `lib/entity-ref.ts`.
   */
  async resolve(kind: "group" | "player" | "npc" | "item", slug: string): Promise<ResolveResult> {
    return withFallback(
      async () =>
        ResolveResultSchema.parse(
          await apiGet(`/resolve/${kind}?slug=${encodeURIComponent(slug)}`, { revalidate: 300 }),
        ),
      () => mockResolve(kind, slug),
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
        (await apiGet(`/groups/${groupId}/discord-channels`, {
          authed: true,
        })) as DiscordChannelList,
      () => ({
        channels: [
          { id: "111111111111111111", name: "drops", position: 0, type: "text" as const },
          { id: "222222222222222222", name: "lootboard", position: 1, type: "text" as const },
          { id: "333333333333333333", name: "announcements", position: 2, type: "text" as const },
          { id: "666666666666666666", name: "achievements", position: 3, type: "forum" as const },
          {
            id: "777777777777777777",
            name: "drops",
            position: 3,
            type: "thread" as const,
            parent_id: "666666666666666666",
          },
          {
            id: "888888888888888888",
            name: "personal-bests",
            position: 3,
            type: "thread" as const,
            parent_id: "666666666666666666",
          },
        ],
        cached: true,
      }),
    );
  },

  /** Boss names that have PBs stored, for the Hall of Fame boss picker. */
  async groupPbBosses(groupId: number): Promise<PbBossList> {
    return withFallback(
      async () => (await apiGet(`/groups/${groupId}/pb-bosses`, { authed: true })) as PbBossList,
      () => ({
        bosses: ["Chambers Of Xeric", "Theatre Of Blood", "Tombs Of Amascut", "Vorkath", "Zulrah"],
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

  /** Per-group manual-policy notices for a player before submitting (Ph 3). */
  async manualPreflight(playerId: number): Promise<ManualPreflight> {
    return withFallback(
      async () =>
        ManualPreflightSchema.parse(
          await apiGet(`/submissions/manual/preflight?player_id=${playerId}`, { authed: true }),
        ),
      () => ({ notices: [] }),
    );
  },

  /** A group's manual-submission review queue (pending + recent). */
  async manualSubmissions(groupId: number): Promise<ManualSubmissionQueue> {
    return withFallback(
      async () =>
        ManualSubmissionQueueSchema.parse(
          await apiGet(`/groups/${groupId}/manual-submissions`, { authed: true }),
        ),
      () => mockManualSubmissions(),
    );
  },

  async approveManualSubmission(groupId: number, dropId: number): Promise<{ status: string }> {
    return withFallback(
      async () =>
        (await apiSend(
          "POST",
          `/groups/${groupId}/manual-submissions/${dropId}/approve`,
          {},
        )) as { status: string },
      () => ({ status: "approved" }),
    );
  },

  async rejectManualSubmission(groupId: number, dropId: number): Promise<{ status: string }> {
    return withFallback(
      async () =>
        (await apiSend(
          "POST",
          `/groups/${groupId}/manual-submissions/${dropId}/reject`,
          {},
        )) as { status: string },
      () => ({ status: "rejected" }),
    );
  },

  /**
   * Upload proof media (multipart 'file') for a manual submission. The Web API
   * stores it in B2 server-side and returns the object key + public CDN URL;
   * `key` is passed back as `proof_upload_key` on the submission. This replaces
   * a direct browser→B2 presigned PUT, which the bucket's CORS policy (GET/HEAD
   * only) rejected at preflight ("Failed to fetch").
   */
  async uploadProof(form: FormData): Promise<{ key: string; public_url: string }> {
    return withFallback(
      async () =>
        (await apiSendForm("POST", "/uploads/proof", form)) as {
          key: string;
          public_url: string;
        },
      () => ({ key: `dt_uploads/mock-${Date.now()}.png`, public_url: "" }),
    );
  },

  // --- Announcements (write) --------------------------------------------
  /** Roles of the group's linked guild (bot-cached; stale=true while warming). */
  async groupDiscordRoles(groupId: number): Promise<GroupDiscordRoles> {
    return withFallback(
      async () =>
        GroupDiscordRolesSchema.parse(
          await apiGet(`/groups/${groupId}/discord/roles`, { authed: true }),
        ),
      () => ({
        roles: [
          { id: "111111111111111111", name: "Clanmate", position: 2 },
          { id: "222222222222222222", name: "Events", position: 1 },
        ],
        stale: false,
      }),
    );
  },

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
      () => ({
        id,
        scope_type: "global" as const,
        title: "",
        body_md: "",
        pinned: false,
        published_at: 0,
        ...patch,
      }),
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
  async groupMembers(groupId: number, page = 1, q?: string): Promise<GroupMembersPage> {
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set("q", q);
    return withFallback(
      async () =>
        GroupMembersPageSchema.parse(
          await apiGet(`/groups/${groupId}/members?${params}`, { authed: true }),
        ),
      () => mockGroupMembers(groupId, page),
    );
  },

  // --- Authorized users (post-creation admin management) -----------------
  async groupAuthorizedUsers(groupId: number): Promise<AuthorizedUsersResponse> {
    return withFallback(
      async () =>
        AuthorizedUsersResponseSchema.parse(
          await apiGet(`/groups/${groupId}/authorized-users`, { authed: true }),
        ),
      () => mockAuthorizedUsers(),
    );
  },

  /** Add by Discord ID (snowflake) or DropTracker username. */
  async addGroupAuthorizedUser(
    groupId: number,
    identifier: string,
  ): Promise<AuthorizedUsersResponse> {
    return withFallback(
      async () =>
        AuthorizedUsersResponseSchema.parse(
          await apiSend("POST", `/groups/${groupId}/authorized-users`, { identifier }),
        ),
      () => mockAuthorizedUsers(),
    );
  },

  async removeGroupAuthorizedUser(
    groupId: number,
    target: { user_id?: number | null; discord_id?: string | null },
  ): Promise<AuthorizedUsersResponse> {
    return withFallback(
      async () =>
        AuthorizedUsersResponseSchema.parse(
          await apiSend("DELETE", `/groups/${groupId}/authorized-users`, target),
        ),
      () => mockAuthorizedUsers(),
    );
  },

  // --- Event managers (web64a: full event control, no group admin) --------
  async groupEventManagers(groupId: number): Promise<EventManagersResponse> {
    return withFallback(
      async () =>
        EventManagersResponseSchema.parse(
          await apiGet(`/groups/${groupId}/event-managers`, { authed: true }),
        ),
      () => mockEventManagers(),
    );
  },

  /** Add by Discord ID (snowflake) or DropTracker username. */
  async addGroupEventManager(
    groupId: number,
    identifier: string,
  ): Promise<EventManagersResponse> {
    return withFallback(
      async () =>
        EventManagersResponseSchema.parse(
          await apiSend("POST", `/groups/${groupId}/event-managers`, { identifier }),
        ),
      () => mockEventManagers(),
    );
  },

  async removeGroupEventManager(
    groupId: number,
    userId: number,
  ): Promise<EventManagersResponse> {
    return withFallback(
      async () =>
        EventManagersResponseSchema.parse(
          await apiSend("DELETE", `/groups/${groupId}/event-managers`, { user_id: userId }),
        ),
      () => mockEventManagers(),
    );
  },

  // --- Custom points system ----------------------------------------------
  async groupPointsSettings(groupId: number): Promise<PointsSettings> {
    return PointsSettingsSchema.parse(
      await apiGet(`/groups/${groupId}/points/settings`, { authed: true }),
    );
  },

  async updateGroupPointsSettings(
    groupId: number,
    patch: { rules?: Partial<PointRule>[]; behavior?: Partial<PointsBehavior> },
  ): Promise<{ rules: PointRule[]; behavior: PointsBehavior }> {
    return z
      .object({ rules: z.array(PointRuleSchema), behavior: PointsBehaviorSchema })
      .parse(await apiSend("PUT", `/groups/${groupId}/points/settings`, patch));
  },

  async groupPointMods(groupId: number): Promise<PointMod[]> {
    const data = z
      .object({ mods: z.array(PointModSchema) })
      .parse(await apiGet(`/groups/${groupId}/points/mods`, { authed: true }));
    return data.mods;
  },

  async createGroupPointMod(groupId: number, body: unknown): Promise<PointMod[]> {
    const data = z
      .object({ mods: z.array(PointModSchema) })
      .parse(await apiSend("POST", `/groups/${groupId}/points/mods`, body));
    return data.mods;
  },

  async updateGroupPointMod(groupId: number, modId: number, body: unknown): Promise<PointMod[]> {
    const data = z
      .object({ mods: z.array(PointModSchema) })
      .parse(await apiSend("PATCH", `/groups/${groupId}/points/mods/${modId}`, body));
    return data.mods;
  },

  async deleteGroupPointMod(groupId: number, modId: number): Promise<PointMod[]> {
    const data = z
      .object({ mods: z.array(PointModSchema) })
      .parse(await apiSend("DELETE", `/groups/${groupId}/points/mods/${modId}`, {}));
    return data.mods;
  },

  async groupPointLists(groupId: number): Promise<PointListEntry[]> {
    const data = z
      .object({ entries: z.array(PointListEntrySchema) })
      .parse(await apiGet(`/groups/${groupId}/points/lists`, { authed: true }));
    return data.entries;
  },

  async createGroupPointListEntry(groupId: number, body: unknown): Promise<PointListEntry[]> {
    const data = z
      .object({ entries: z.array(PointListEntrySchema) })
      .parse(await apiSend("POST", `/groups/${groupId}/points/lists`, body));
    return data.entries;
  },

  async deleteGroupPointListEntry(groupId: number, entryId: number): Promise<PointListEntry[]> {
    const data = z
      .object({ entries: z.array(PointListEntrySchema) })
      .parse(await apiSend("DELETE", `/groups/${groupId}/points/lists/${entryId}`, {}));
    return data.entries;
  },

  async groupPointBoosts(groupId: number): Promise<PointBoost[]> {
    const data = z
      .object({ boosts: z.array(PointBoostSchema) })
      .parse(await apiGet(`/groups/${groupId}/points/boosts`, { authed: true }));
    return data.boosts;
  },

  async createGroupPointBoost(groupId: number, body: unknown): Promise<PointBoost[]> {
    const data = z
      .object({ boosts: z.array(PointBoostSchema) })
      .parse(await apiSend("POST", `/groups/${groupId}/points/boosts`, body));
    return data.boosts;
  },

  async updateGroupPointBoost(
    groupId: number,
    boostId: number,
    body: unknown,
  ): Promise<PointBoost[]> {
    const data = z
      .object({ boosts: z.array(PointBoostSchema) })
      .parse(await apiSend("PATCH", `/groups/${groupId}/points/boosts/${boostId}`, body));
    return data.boosts;
  },

  async deleteGroupPointBoost(groupId: number, boostId: number): Promise<PointBoost[]> {
    const data = z
      .object({ boosts: z.array(PointBoostSchema) })
      .parse(await apiSend("DELETE", `/groups/${groupId}/points/boosts/${boostId}`, {}));
    return data.boosts;
  },

  async createGroupPointSeason(
    groupId: number,
    body: { name: string; start_at: string; end_at: string },
  ): Promise<PointSeason> {
    const data = z
      .object({ season: PointSeasonSchema })
      .parse(await apiSend("POST", `/groups/${groupId}/points/seasons`, body));
    return data.season;
  },

  async updateGroupPointSeason(
    groupId: number,
    seasonId: number,
    body: Partial<{ name: string; start_at: string; end_at: string }>,
  ): Promise<PointSeason> {
    const data = z
      .object({ season: PointSeasonSchema })
      .parse(await apiSend("PATCH", `/groups/${groupId}/points/seasons/${seasonId}`, body));
    return data.season;
  },

  async deleteGroupPointSeason(groupId: number, seasonId: number): Promise<void> {
    await apiSend("DELETE", `/groups/${groupId}/points/seasons/${seasonId}`, {});
  },

  async adjustGroupPoints(
    groupId: number,
    body: { player_id: number; amount: number; reason: string },
  ): Promise<PointsAdjustResult> {
    return PointsAdjustResultSchema.parse(
      await apiSend("POST", `/groups/${groupId}/points/adjust`, body),
    );
  },

  async groupPointsHistory(
    groupId: number,
    params: { player_id?: number; manual?: boolean; page?: number; limit?: number } = {},
  ): Promise<PointsHistoryPage> {
    const q = new URLSearchParams();
    if (params.player_id) q.set("player_id", String(params.player_id));
    if (params.manual) q.set("manual", "1");
    if (params.page) q.set("page", String(params.page));
    if (params.limit) q.set("limit", String(params.limit));
    return PointsHistoryPageSchema.parse(
      await apiGet(`/groups/${groupId}/points/history?${q}`, { authed: true }),
    );
  },

  async resetGroupPoints(groupId: number): Promise<{ deleted: number }> {
    return z
      .object({ deleted: z.number().int() })
      .parse(await apiSend("POST", `/groups/${groupId}/points/reset`, { confirm: "RESET" }));
  },

  /** Public points leaderboard (authed pass-through so members can view
   * private boards). */
  async groupPointsLeaderboard(
    groupId: number,
    params: { period?: string; page?: number; limit?: number } = {},
  ): Promise<PointsLeaderboard> {
    const q = new URLSearchParams();
    if (params.period) q.set("period", params.period);
    if (params.page) q.set("page", String(params.page));
    if (params.limit) q.set("limit", String(params.limit));
    return PointsLeaderboardSchema.parse(
      await apiGet(`/groups/${groupId}/points/leaderboard?${q}`, { authed: true }),
    );
  },

  async setHiddenPlayer(groupId: number, playerId: number, hidden: boolean): Promise<{ ok: true }> {
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
      async () =>
        WomSyncResultSchema.parse(await apiSend("POST", `/groups/${groupId}/wom-sync`, {})),
      () => mockWomSync(),
    );
  },

  async diagnostics(groupId: number): Promise<GroupDiagnostics> {
    return withFallback(
      async () =>
        GroupDiagnosticsSchema.parse(
          await apiGet(`/groups/${groupId}/diagnostics`, { authed: true }),
        ),
      () => mockDiagnostics(),
    );
  },

  // --- Group creation wizard --------------------------------------------
  async womLookup(womId: number): Promise<WomGroupPreview> {
    return withFallback(
      async () =>
        WomGroupPreviewSchema.parse(await apiGet(`/groups/wom-lookup/${womId}`, { authed: true })),
      () => mockWomLookup(womId),
    );
  },

  async guildStatus(guildId: string, opts?: { refresh?: boolean }): Promise<GuildStatus> {
    // refresh=1 busts the backend's 5-minute bot-presence cache — used by the
    // wizard's invite-the-bot poll so a fresh invite is detected promptly.
    const suffix = opts?.refresh ? "?refresh=1" : "";
    return withFallback(
      async () =>
        GuildStatusSchema.parse(
          await apiGet(`/groups/guild-status/${encodeURIComponent(guildId)}${suffix}`, {
            authed: true,
          }),
        ),
      () => mockGuildStatus(guildId),
    );
  },

  async createGroup(input: CreateGroupInput): Promise<CreateGroupResult> {
    return withFallback(
      async () => CreateGroupResultSchema.parse(await apiSend("POST", `/groups`, input)),
      () => ({
        id: Math.floor(100 + Math.random() * 900),
        name: input.name,
        wom_id: input.wom_id,
        guild_id: input.guild_id,
      }),
    );
  },

  /** Discord servers the caller can manage (wizard server picker). */
  async manageableGuilds(): Promise<MyGuilds> {
    return withFallback(
      async () => MyGuildsSchema.parse(await apiGet(`/me/guilds`, { authed: true })),
      () => ({ guilds: mockManageableGuilds(), cached: true }),
    );
  },

  /** Public bot application info for the wizard's "Invite the bot" button. */
  async botInvite(): Promise<BotInvite> {
    return withFallback(
      async () => BotInviteSchema.parse(await apiGet(`/meta/bot-invite`, { revalidate: 3600 })),
      () => mockBotInvite(),
    );
  },

  // --- RSN claim flow ----------------------------------------------------
  async claimPreview(rsn: string, guildId?: string): Promise<ClaimPreview> {
    const q = new URLSearchParams({ rsn });
    if (guildId) q.set("guild_id", guildId);
    return withFallback(
      async () =>
        ClaimPreviewSchema.parse(
          await apiGet(`/me/players/claim-preview?${q.toString()}`, { authed: true }),
        ),
      () => mockClaimPreview(rsn),
    );
  },

  async claimPlayer(input: { rsn: string; guild_id?: string }): Promise<ClaimResult> {
    return withFallback(
      async () => ClaimResultSchema.parse(await apiSend("POST", `/me/players/claim`, input)),
      () => mockClaimResult(input.rsn),
    );
  },

  async unclaimPlayer(playerId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/me/players/${playerId}/claim`, undefined);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  // --- Group subscriptions / upgrades -----------------------------------
  /**
   * Group tiers by default; pass "user" or "all" to widen (e.g. admin).
   * `includeFree` surfaces $0 fallback tiers (the non-premium plan) — admin
   * only; public listings hide them so they never render as a checkout option.
   */
  async subscriptionTiers(
    scope: "group" | "user" | "all" = "group",
    opts?: { includeFree?: boolean },
  ): Promise<SubscriptionTier[]> {
    const qs = `?scope=${scope}${opts?.includeFree ? "&include_free=1" : ""}`;
    return withFallback(
      async () =>
        SubscriptionTierSchema.array().parse(
          await apiGet(`/subscriptions/tiers${qs}`, { revalidate: 300 }),
        ),
      () => mockSubscriptionTiers(),
    );
  },

  async groupSubscription(groupId: number): Promise<GroupSubscription> {
    return withFallback(
      async () =>
        GroupSubscriptionSchema.parse(
          await apiGet(`/groups/${groupId}/subscription`, { authed: true }),
        ),
      () => mockGroupSubscription(groupId),
    );
  },

  /** Public pool summary for the group page "Support this clan" card. */
  async groupSubscriptionSummary(groupId: number): Promise<GroupSubscriptionSummary> {
    return withFallback(
      async () =>
        GroupSubscriptionSummarySchema.parse(
          await apiGet(`/groups/${groupId}/subscription/summary`, { revalidate: 60 }),
        ),
      () => mockGroupSubscriptionSummary(groupId),
    );
  },

  /** Add a contribution leg toward `tierKey` (pool model: any group member
   * pays the difference between the tier price and the current pool). */
  async subscriptionCheckout(groupId: number, tierKey: string): Promise<CheckoutSession> {
    return withFallback(
      async () =>
        CheckoutSessionSchema.parse(
          await apiSend("POST", `/groups/${groupId}/subscription/checkout`, { tier_key: tierKey }),
        ),
      () => ({ url: null }),
    );
  },

  /** Wind down ONE contribution leg (payer or group admin). */
  async cancelSubscriptionLeg(groupId: number, legId: number): Promise<GroupSubscription> {
    return withFallback(
      async () =>
        GroupSubscriptionSchema.parse(
          await apiSend("POST", `/groups/${groupId}/subscription/legs/${legId}/cancel`, {}),
        ),
      () => ({ ...mockGroupSubscription(groupId), cancel_at_period_end: true }),
    );
  },

  async resumeSubscriptionLeg(groupId: number, legId: number): Promise<GroupSubscription> {
    return withFallback(
      async () =>
        GroupSubscriptionSchema.parse(
          await apiSend("POST", `/groups/${groupId}/subscription/legs/${legId}/resume`, {}),
        ),
      () => ({ ...mockGroupSubscription(groupId), cancel_at_period_end: false }),
    );
  },

  // --- Custom Discord embeds (subscription-gated) ------------------------
  /** Per-type embed templates: the group's custom template + system default. */
  async groupEmbeds(groupId: number): Promise<GroupEmbedsResponse> {
    return withFallback(
      async () =>
        GroupEmbedsResponseSchema.parse(
          await apiGet(`/groups/${groupId}/embeds`, { authed: true }),
        ),
      () => mockGroupEmbeds(),
    );
  },

  /** Save (upsert) the group's template for one embed type. Requires the `custom_embeds` entitlement. */
  async saveGroupEmbed(
    groupId: number,
    embedType: EmbedType,
    input: GroupEmbedInput,
  ): Promise<GroupEmbed> {
    return withFallback(
      async () => {
        const res = (await apiSend("PUT", `/groups/${groupId}/embeds/${embedType}`, input)) as {
          embed: unknown;
        };
        return GroupEmbedSchema.parse(res.embed);
      },
      () => GroupEmbedSchema.parse({ embed_type: embedType, ...input }),
    );
  },

  /** Remove the group's custom template for one type (reverts to the default). */
  async deleteGroupEmbed(groupId: number, embedType: EmbedType): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/groups/${groupId}/embeds/${embedType}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  // --- Event message layouts (web66a, subscription-gated) ----------------
  /** Editor metadata: message types, token docs, limits, sample standings. */
  async eventLayoutMeta(): Promise<EventLayoutMeta> {
    return withFallback(
      async () => EventLayoutMetaSchema.parse(await apiGet(`/event-layouts/meta`, { authed: true })),
      () => mockEventLayoutMeta(),
    );
  },

  /** Per-type event message layouts: the group's custom layout + system default. */
  async groupEventLayouts(groupId: number): Promise<GroupEventLayoutsResponse> {
    return withFallback(
      async () =>
        GroupEventLayoutsResponseSchema.parse(
          await apiGet(`/groups/${groupId}/event-layouts`, { authed: true }),
        ),
      () => mockGroupEventLayouts(),
    );
  },

  /** Save the group's layout for one event message type. Requires `custom_embeds`. */
  async saveGroupEventLayout(
    groupId: number,
    messageType: string,
    input: EventMessageLayoutInput,
  ): Promise<EventMessageLayout> {
    return withFallback(
      async () => {
        const res = (await apiSend("PUT", `/groups/${groupId}/event-layouts/${messageType}`, input)) as {
          layout: unknown;
        };
        return EventMessageLayoutSchema.parse(res.layout);
      },
      () =>
        EventMessageLayoutSchema.parse({
          message_type: messageType,
          accent_color: input.accent_color ?? null,
          blocks: input.blocks,
        }),
    );
  },

  /** Remove the group's layout for one type (reverts to the system default). */
  async deleteGroupEventLayout(groupId: number, messageType: string): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/groups/${groupId}/event-layouts/${messageType}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  /** One event's layout overrides + the effective (group-level) layouts. */
  async eventLayouts(eventId: number): Promise<EventLayoutsResponse> {
    return withFallback(
      async () =>
        EventLayoutsResponseSchema.parse(await apiGet(`/events/${eventId}/layouts`, { authed: true })),
      () => mockEventLayouts(),
    );
  },

  /** Save a one-event layout override. Requires the host group's `custom_embeds`. */
  async saveEventLayout(
    eventId: number,
    messageType: string,
    input: EventMessageLayoutInput,
  ): Promise<EventMessageLayout> {
    return withFallback(
      async () => {
        const res = (await apiSend("PUT", `/events/${eventId}/layouts/${messageType}`, input)) as {
          layout: unknown;
        };
        return EventMessageLayoutSchema.parse(res.layout);
      },
      () =>
        EventMessageLayoutSchema.parse({
          message_type: messageType,
          accent_color: input.accent_color ?? null,
          blocks: input.blocks,
        }),
    );
  },

  /** Remove a one-event override (reverts to the group's layout). */
  async deleteEventLayout(eventId: number, messageType: string): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/events/${eventId}/layouts/${messageType}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  /** Open the provider's billing portal (update card, invoices, cancel). */
  async billingPortal(groupId: number): Promise<CheckoutSession> {
    return withFallback(
      async () =>
        CheckoutSessionSchema.parse(
          await apiSend("POST", `/groups/${groupId}/subscription/portal`, {}),
        ),
      () => ({ url: null }),
    );
  },

  // --- User supporter subscription ---------------------------------------
  /** User-scoped supporter tiers for the pricing page. */
  async supporterTiers(): Promise<SubscriptionTier[]> {
    return withFallback(
      async () =>
        SubscriptionTierSchema.array().parse(
          await apiGet(`/subscriptions/tiers?scope=user`, { revalidate: 300 }),
        ),
      () => [],
    );
  },

  async mySubscription(): Promise<UserSubscription> {
    return withFallback(
      async () =>
        UserSubscriptionSchema.parse(await apiGet(`/users/me/subscription`, { authed: true })),
      () => mockUserSubscription(),
    );
  },

  /** Begin (or switch to) a supporter tier; returns a provider redirect URL.
   * Pay-what-you-want: `amountCents` (>= tier minimum) picks the recurring
   * amount; omitted = the tier minimum. */
  async mySubscriptionCheckout(tierKey: string, amountCents?: number): Promise<CheckoutSession> {
    return withFallback(
      async () =>
        CheckoutSessionSchema.parse(
          await apiSend("POST", `/users/me/subscription/checkout`, {
            tier_key: tierKey,
            ...(amountCents != null ? { amount_cents: amountCents } : {}),
          }),
        ),
      () => ({ url: null }),
    );
  },

  async cancelMySubscription(): Promise<UserSubscription> {
    return withFallback(
      async () =>
        UserSubscriptionSchema.parse(await apiSend("POST", `/users/me/subscription/cancel`, {})),
      () => ({ ...mockUserSubscription(), cancel_at_period_end: true }),
    );
  },

  async resumeMySubscription(): Promise<UserSubscription> {
    return withFallback(
      async () =>
        UserSubscriptionSchema.parse(await apiSend("POST", `/users/me/subscription/resume`, {})),
      () => ({ ...mockUserSubscription(), cancel_at_period_end: false }),
    );
  },

  /** Open the provider's billing portal for the supporter subscription. */
  async myBillingPortal(): Promise<CheckoutSession> {
    return withFallback(
      async () =>
        CheckoutSessionSchema.parse(await apiSend("POST", `/users/me/subscription/portal`, {})),
      () => ({ url: null }),
    );
  },

  /** Lootboard style catalog (id, category, preview) for the board-style picker. */
  async lootboardStyles(): Promise<LootboardStyleList> {
    return withFallback(
      async () => LootboardStyleListSchema.parse(await apiGet(`/lootboard-styles`)),
      () => ({
        styles: [
          { id: 1, name: "Classic Bank", category: "Classic", description: "The original dark bank layout.", preview_url: "https://www.droptracker.io/img/lootboards/1.png" },
          { id: 2, name: "Clean Light", category: "Classic", description: "Light parchment variant.", preview_url: "https://www.droptracker.io/img/lootboards/2.png" },
          { id: 3, name: "RuneLite Dark", category: "RuneLite", description: "Matches the RuneLite client theme.", preview_url: "https://www.droptracker.io/img/lootboards/3.png" },
        ],
      }),
    );
  },

  /** Whether seasonal-world (Leagues/DMM) submission processing is globally on. */
  async seasonalStatus(): Promise<{ active: boolean }> {
    return withFallback(
      async () =>
        z.object({ active: z.boolean() }).parse(await apiGet(`/seasonal-status`)),
      () => ({ active: true }),
    );
  },

  // --- Superadmin --------------------------------------------------------
  /** Current state of the global seasonal-processing kill switch. */
  async adminSeasonal(): Promise<{ active: boolean }> {
    return withFallback(
      async () =>
        z.object({ active: z.boolean() }).parse(await apiGet(`/admin/seasonal`, { authed: true })),
      () => ({ active: true }),
    );
  },

  /** Toggle seasonal-world submission processing globally. */
  async adminSetSeasonal(active: boolean): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/admin/seasonal`, { active });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  // --- Event types (web43a) ----------------------------------------------
  /** The site-wide event-type registry with per-kind test-group allowlists. */
  async adminEventTypes(): Promise<AdminEventType[]> {
    return withFallback(
      async () =>
        AdminEventTypeSchema.array().parse(
          await apiGet(`/admin/event-types`, { authed: true }),
        ),
      () => [],
    );
  },

  /** Toggle a kind's enabled / admin_only flags; returns the updated row. */
  async adminPatchEventType(
    key: string,
    patch: { enabled?: boolean; admin_only?: boolean },
  ): Promise<AdminEventType> {
    return AdminEventTypeSchema.parse(
      await apiSend("PATCH", `/admin/event-types/${encodeURIComponent(key)}`, patch),
    );
  },

  /** Add a group to a kind's test allowlist; returns the updated row. */
  async adminAddEventTypeTestGroup(key: string, groupId: number): Promise<AdminEventType> {
    return AdminEventTypeSchema.parse(
      await apiSend("POST", `/admin/event-types/${encodeURIComponent(key)}/test-groups`, {
        group_id: groupId,
      }),
    );
  },

  /** Remove a group from a kind's test allowlist; returns the updated row. */
  async adminRemoveEventTypeTestGroup(key: string, groupId: number): Promise<AdminEventType> {
    return AdminEventTypeSchema.parse(
      await apiSend(
        "DELETE",
        `/admin/event-types/${encodeURIComponent(key)}/test-groups/${groupId}`,
        {},
      ),
    );
  },

  // --- Event rate limits (web65a) ----------------------------------------
  /** Every configured per-tier event frequency cap. */
  async adminEventRateLimits(): Promise<AdminEventRateLimit[]> {
    return withFallback(
      async () =>
        AdminEventRateLimitSchema.array().parse(
          await apiGet(`/admin/event-rate-limits`, { authed: true }),
        ),
      () => [],
    );
  },

  /** Upsert one cap, keyed by (tier_key, type_key); returns the stored row. */
  async adminPutEventRateLimit(input: {
    tier_key: string;
    type_key: string;
    max_events: number;
    window_days: number;
    enabled?: boolean;
  }): Promise<AdminEventRateLimit> {
    return AdminEventRateLimitSchema.parse(
      await apiSend("PUT", `/admin/event-rate-limits`, input),
    );
  },

  /** Delete one cap (that scope reverts to unlimited). */
  async adminDeleteEventRateLimit(id: number): Promise<void> {
    await apiSend("DELETE", `/admin/event-rate-limits/${id}`, {});
  },

  async adminServices(): Promise<ServiceStatus[]> {
    return withFallback(
      async () =>
        ServiceStatusSchema.array().parse(await apiGet(`/admin/services`, { authed: true })),
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

  async adminServiceLogs(unit: string, lines = 200): Promise<ServiceLogs> {
    return withFallback(
      async () =>
        ServiceLogsSchema.parse(
          await apiGet(
            `/admin/services/${encodeURIComponent(unit)}/logs?lines=${encodeURIComponent(lines)}`,
            { authed: true },
          ),
        ),
      () => mockServiceLogs(unit),
    );
  },

  async adminBackups(): Promise<BackupOverview> {
    return withFallback(
      async () => BackupOverviewSchema.parse(await apiGet(`/admin/backups`, { authed: true })),
      () => mockBackupOverview(),
    );
  },

  async adminBackupLogs(): Promise<ServiceLogs> {
    return withFallback(
      async () => ServiceLogsSchema.parse(await apiGet(`/admin/backups/logs`, { authed: true })),
      () => mockServiceLogs("droptracker-db-backup"),
    );
  },

  async adminBackupOffsite(): Promise<BackupOffsite> {
    return withFallback(
      async () =>
        BackupOffsiteSchema.parse(await apiGet(`/admin/backups/offsite`, { authed: true })),
      () => mockBackupOffsite(),
    );
  },

  async adminRunBackup(): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/admin/backups/run`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  async adminB2Usage(): Promise<B2Usage> {
    return withFallback(
      async () => B2UsageSchema.parse(await apiGet(`/admin/b2/usage`, { authed: true })),
      () => mockB2Usage(),
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

  // --- Personal-best NPC blocklist ---------------------------------------
  async adminPbBlocks(): Promise<PbBlockList> {
    return withFallback(
      async () => PbBlockListSchema.parse(await apiGet(`/admin/pb-blocks`, { authed: true })),
      () => ({ bosses: [], blocked_ids: [] }),
    );
  },

  async adminPbBlockSearch(q: string): Promise<PbBlockSearchResponse> {
    if (!q.trim()) return { results: [] };
    return withFallback(
      async () =>
        PbBlockSearchResponseSchema.parse(
          await apiGet(`/admin/pb-blocks/search?q=${encodeURIComponent(q)}`, { authed: true }),
        ),
      () => ({ results: [] }),
    );
  },

  /** Block a boss (its variant ids) and purge existing PB rows. `confirm` must
   * be true to actually delete — the backend returns 409 otherwise. */
  async adminAddPbBlock(npcIds: number[], confirm: boolean): Promise<PbBlockMutation> {
    return withFallback(
      async () =>
        PbBlockMutationSchema.parse(
          await apiSend("POST", `/admin/pb-blocks`, { npc_ids: npcIds, confirm }),
        ),
      () => ({ ok: true, blocked_ids: [], bosses: [] }),
    );
  },

  async adminRemovePbBlock(npcId: number): Promise<PbBlockMutation> {
    return withFallback(
      async () =>
        PbBlockMutationSchema.parse(await apiSend("DELETE", `/admin/pb-blocks/${npcId}`, {})),
      () => ({ ok: true, blocked_ids: [], bosses: [] }),
    );
  },

  async adminSaveTier(tier: SubscriptionTierInput, isNew: boolean): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend(
          isNew ? "POST" : "PATCH",
          isNew
            ? `/admin/subscriptions/tiers`
            : `/admin/subscriptions/tiers/${encodeURIComponent(tier.key)}`,
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

  // --- Badges -------------------------------------------------------------
  async badges(): Promise<BadgeDefinition[]> {
    return withFallback(
      async () => BadgeDefinitionSchema.array().parse(await apiGet(`/badges`, { revalidate: 300 })),
      () => [],
    );
  },

  async playerBadges(playerId: number): Promise<PlayerBadgeAward[]> {
    return withFallback(
      async () =>
        PlayerBadgeSchema.array().parse(
          await apiGet(`/players/${playerId}/badges`, { revalidate: 0 }),
        ),
      () => [],
    );
  },

  async adminBadges(): Promise<AdminBadge[]> {
    return withFallback(
      async () => AdminBadgeSchema.array().parse(await apiGet(`/admin/badges`, { authed: true })),
      () => [],
    );
  },

  async adminSaveBadge(input: AdminBadgeInput): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/admin/badges`, input);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  async adminDeleteBadge(key: string): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/admin/badges/${encodeURIComponent(key)}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  async adminAwardBadge(
    playerId: number,
    badgeKey: string,
    note?: string,
  ): Promise<{ award_id: number }> {
    return withFallback(
      async () =>
        (await apiSend("POST", `/admin/players/${playerId}/badges`, {
          badge_key: badgeKey,
          note,
        })) as { award_id: number },
      () => ({ award_id: Math.floor(Math.random() * 100000) }),
    );
  },

  async adminRevokeBadge(playerId: number, awardId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/admin/players/${playerId}/badges/${awardId}`, {});
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

  /** Monetization dashboard: MRR/lifetime KPIs, income by month, every
   * subscription (group legs + supporters), recent ledger payments. */
  async adminSubscriptionsOverview(): Promise<AdminSubscriptionsOverview> {
    return withFallback(
      async () =>
        AdminSubscriptionsOverviewSchema.parse(
          await apiGet(`/admin/subscriptions/overview`, { authed: true }),
        ),
      () => mockAdminSubscriptionsOverview(),
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
        (await apiGet(
          `/admin/data/${encodeURIComponent(entity)}/${encodeURIComponent(String(id))}`,
          {
            authed: true,
          },
        )) as AdminDataRecord,
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
        group: {
          id: groupId,
          name: `Group #${groupId}`,
          member_count: 0,
          guild_id: null,
          wom_id: null,
        },
        subscription: null,
        config_summary: {},
        activity_7d: [],
        last_submission_ts: null,
        warnings: ["API unavailable (mock mode)."],
      }),
    );
  },

  // --- Support tickets (web21a) -------------------------------------------
  async myTickets(params: { page?: number; limit?: number } = {}): Promise<TicketPage> {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return withFallback(
      async () => TicketPageSchema.parse(await apiGet(`/me/tickets${suffix}`, { authed: true })),
      () => mockMyTickets(params.page ?? 1),
    );
  },

  async ticket(ticketId: number): Promise<TicketDetail> {
    return withFallback(
      async () => TicketDetailSchema.parse(await apiGet(`/tickets/${ticketId}`, { authed: true })),
      () => mockTicket(ticketId),
    );
  },

  async adminTickets(
    params: { status?: string; type?: string; q?: string; page?: number; limit?: number } = {},
  ): Promise<AdminTicketPage> {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.type) qs.set("type", params.type);
    if (params.q) qs.set("q", params.q);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return withFallback(
      async () =>
        AdminTicketPageSchema.parse(await apiGet(`/admin/tickets${suffix}`, { authed: true })),
      () => mockAdminTickets(params.page ?? 1),
    );
  },

  async adminTicketAction(
    ticketId: number,
    action: "claim" | "unclaim" | "close",
  ): Promise<TicketSummary> {
    return withFallback(
      async () =>
        TicketSummarySchema.parse(await apiSend("PATCH", `/admin/tickets/${ticketId}`, { action })),
      () => mockMyTickets(1).items[0]!,
    );
  },

  // --- Suggestion forum (web /suggestions, mirrored with Discord) ---------
  async suggestions(
    params: { type?: string; mine?: boolean; open?: boolean; page?: number; limit?: number } = {},
  ): Promise<SuggestionPage> {
    const qs = new URLSearchParams();
    if (params.type) qs.set("type", params.type);
    if (params.mine) qs.set("mine", "1");
    if (params.open) qs.set("open", "1");
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return withFallback(
      async () =>
        SuggestionPageSchema.parse(await apiGet(`/suggestions${suffix}`, { authed: true })),
      () => mockSuggestions(params.page ?? 1),
    );
  },

  async suggestion(id: number): Promise<SuggestionDetail> {
    return withFallback(
      async () =>
        SuggestionDetailSchema.parse(await apiGet(`/suggestions/${id}`, { authed: true })),
      () => mockSuggestionDetail(id),
    );
  },

  async createSuggestion(input: SuggestionCreate): Promise<SuggestionDetail> {
    return withFallback(
      async () => SuggestionDetailSchema.parse(await apiSend("POST", `/suggestions`, input)),
      () => ({ ...mockSuggestionDetail(99), ...input, status: "pending" as const }),
    );
  },

  async createSuggestionReply(
    suggestionId: number,
    input: SuggestionReplyCreate,
  ): Promise<SuggestionMessage> {
    return withFallback(
      async () =>
        SuggestionMessageSchema.parse(
          await apiSend("POST", `/suggestions/${suggestionId}/messages`, input),
        ),
      () => mockSuggestionDetail(suggestionId).messages[0]!,
    );
  },

  // --- Superadmin dashboard: audit log -----------------------------------
  async adminAuditLog(
    params: {
      action?: string;
      actorUserId?: number;
      groupId?: number;
      q?: string;
      page?: number;
      limit?: number;
    } = {},
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
      () => ({
        entries: [],
        meta: { page: params.page ?? 1, limit: params.limit ?? 50, total: 0 },
      }),
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
          is_moderator: false,
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

  /** Grant/revoke the moderator flag (also awards/revokes the profile badge). */
  async adminSetUserModerator(userId: number, grant: boolean): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/admin/users/${userId}/moderator`, { grant });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },
};
