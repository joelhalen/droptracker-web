/**
 * Shared Web API v1 contract.
 *
 * The OpenAPI document (`openapi.json`) is the single source of truth; running
 * `pnpm gen` regenerates `src/generated/openapi.ts` via openapi-typescript.
 *
 * This module additionally exports hand-authored Zod schemas. They mirror the
 * OpenAPI components and are used for runtime validation on the BFF boundary
 * and for React Hook Form on the client (FRONTEND_PLAN.md §4 "Forms/validation").
 */
import { z } from "zod";

/** Time partitions supported by the leaderboard API (FRONTEND_PLAN.md §6.5). */
export const PeriodSchema = z
  .string()
  .regex(/^(all|\d{6}|\d{4}W\d{2}|\d{8})$/i, "Expected all | YYYYMM | YYYYWW | YYYYMMDD");
export type Period = z.infer<typeof PeriodSchema>;

export const MoneySchema = z.object({
  value: z.number().int(),
  value_formatted: z.string(),
});
export type Money = z.infer<typeof MoneySchema>;

export const PageMetaSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
});
export type PageMeta = z.infer<typeof PageMetaSchema>;

export const LeaderboardEntrySchema = z.object({
  rank: z.number().int(),
  id: z.number().int(),
  name: z.string(),
  loot: MoneySchema,
  delta: z.number().int().optional(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const LeaderboardPageSchema = z.object({
  period: z.string(),
  scope: z.string(),
  entries: z.array(LeaderboardEntrySchema),
  meta: PageMetaSchema,
});
export type LeaderboardPage = z.infer<typeof LeaderboardPageSchema>;

export const PlayerSummarySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  global_rank: z.number().int().optional(),
  total_loot: MoneySchema.optional(),
});
export type PlayerSummary = z.infer<typeof PlayerSummarySchema>;

export const SubmissionSchema = z.object({
  id: z.number().int(),
  type: z.enum(["drop", "clog", "pb", "ca", "pet", "level", "quest"]),
  label: z.string(),
  value: MoneySchema.optional(),
  image_url: z.string().optional(),
  ts: z.number().int(),
});
export type Submission = z.infer<typeof SubmissionSchema>;

export const GroupMembershipSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});
export type GroupMembership = z.infer<typeof GroupMembershipSchema>;

export const PlayerProfileSchema = PlayerSummarySchema.extend({
  points: z.number().int().optional(),
  top_npc: z.string().optional(),
  groups: z.array(GroupMembershipSchema).default([]),
  recent_submissions: z.array(SubmissionSchema).default([]),
});
export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;

export const GroupProfileSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().optional(),
  member_count: z.number().int(),
  global_rank: z.number().int().optional(),
  monthly_loot: MoneySchema.optional(),
  discord_url: z.string().optional(),
  top_player: PlayerSummarySchema.optional(),
  recent_submissions: z.array(SubmissionSchema).default([]),
});
export type GroupProfile = z.infer<typeof GroupProfileSchema>;

export const AnnouncementSchema = z.object({
  id: z.number().int(),
  scope_type: z.enum(["global", "group"]),
  group_id: z.number().int().nullable().optional(),
  title: z.string(),
  body_md: z.string(),
  cover_image_url: z.string().nullable().optional(),
  pinned: z.boolean().default(false),
  author_name: z.string().optional(),
  published_at: z.number().int(),
});
export type Announcement = z.infer<typeof AnnouncementSchema>;

export const AnnouncementPageSchema = z.object({
  items: z.array(AnnouncementSchema),
  next_cursor: z.string().nullable().optional(),
});
export type AnnouncementPage = z.infer<typeof AnnouncementPageSchema>;

export const MeSchema = z.object({
  user_id: z.number().int(),
  discord_id: z.string(),
  display_name: z.string().optional(),
  avatar_url: z.string().nullable().optional(),
  /** Site staff: unlocks the superadmin surfaces (FRONTEND_PLAN.md §9). */
  is_superadmin: z.boolean().default(false),
  players: z.array(PlayerSummarySchema).default([]),
  groups: z
    .array(
      z.object({
        id: z.number().int(),
        name: z.string(),
        role: z.enum(["owner", "admin", "member"]),
      }),
    )
    .default([]),
});
export type Me = z.infer<typeof MeSchema>;

/** Realtime SSE event envelope (FRONTEND_PLAN.md §8.3). */
export const RealtimeEventSchema = z.object({
  v: z.literal(1),
  type: z.enum(["drop", "leaderboard_delta", "announcement", "submission"]),
  scope: z.string(),
  ts: z.number().int(),
  data: z.record(z.string(), z.unknown()),
});
export type RealtimeEvent = z.infer<typeof RealtimeEventSchema>;

/**
 * Account settings (FRONTEND_PLAN.md §9 "Notification & privacy prefs",
 * PATCH /api/v1/me). Mirrors the PHP `/account/droptracker` form.
 */
export const AccountSettingsSchema = z.object({
  public: z.boolean(),
  hidden: z.boolean(),
  global_ping: z.boolean(),
  group_ping: z.boolean(),
  never_ping: z.boolean(),
  dm_on_rank_change: z.boolean(),
  dm_on_points: z.boolean(),
  update_logs_opt_in: z.boolean(),
  patreon_group: z.number().int().nullable(),
  premium_group: z.number().int().nullable(),
});
export type AccountSettings = z.infer<typeof AccountSettingsSchema>;
/** PATCH body: any subset of the settings. */
export const AccountSettingsPatchSchema = AccountSettingsSchema.partial();
export type AccountSettingsPatch = z.infer<typeof AccountSettingsPatchSchema>;

/** Combined player+group search results (FRONTEND_PLAN.md §9 "Search"). */
export const SearchResultsSchema = z.object({
  players: z.array(PlayerSummarySchema),
  groups: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      member_count: z.number().int().optional(),
    }),
  ),
});
export type SearchResults = z.infer<typeof SearchResultsSchema>;

/**
 * Manual submission input (FRONTEND_PLAN.md §6.3, wraps `/manual-submit`).
 * The proof image/video is uploaded separately via the B2 presign flow; this
 * carries the metadata.
 */
export const ManualSubmissionSchema = z.object({
  type: z.enum(["drop", "clog", "pb", "ca", "pet"]),
  player_id: z.number().int(),
  npc_name: z.string().optional(),
  item_name: z.string().optional(),
  value: z.number().int().nonnegative().optional(),
  quantity: z.number().int().positive().default(1),
  proof_upload_key: z.string().optional(),
  notes: z.string().max(500).optional(),
});
export type ManualSubmission = z.infer<typeof ManualSubmissionSchema>;

/** Announcement create/update input (FRONTEND_PLAN.md §10). */
export const AnnouncementInputSchema = z.object({
  scope_type: z.enum(["global", "group"]),
  group_id: z.number().int().nullable().optional(),
  title: z.string().min(1).max(200),
  body_md: z.string().min(1),
  pinned: z.boolean().default(false),
  cover_image_url: z.string().url().nullable().optional(),
  /** Also syndicate to the group's announcements Discord channel (§10.1). */
  post_to_discord: z.boolean().default(true),
});
export type AnnouncementInput = z.infer<typeof AnnouncementInputSchema>;

/** Group member row (FRONTEND_PLAN.md §9 "Members"). */
export const GroupMemberSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  group_rank: z.string().optional(),
  total_loot: MoneySchema.optional(),
  hidden: z.boolean().default(false),
});
export type GroupMember = z.infer<typeof GroupMemberSchema>;

export const GroupMembersPageSchema = z.object({
  members: z.array(GroupMemberSchema),
  meta: PageMetaSchema,
});
export type GroupMembersPage = z.infer<typeof GroupMembersPageSchema>;

/** WOM membership sync result (FRONTEND_PLAN.md §6.3 wom-sync). */
export const WomSyncResultSchema = z.object({
  added: z.number().int(),
  removed: z.number().int(),
  total: z.number().int(),
  synced_ts: z.number().int(),
});
export type WomSyncResult = z.infer<typeof WomSyncResultSchema>;

/** Pipeline heartbeat for the admin diagnostics panel (FRONTEND_PLAN.md §9). */
export const GroupDiagnosticsSchema = z.object({
  intake_healthy: z.boolean(),
  last_submission_ts: z.number().int().nullable(),
  members_synced_ts: z.number().int().nullable(),
  activity_7d: z.array(z.object({ date: z.string(), submissions: z.number().int() })),
  warnings: z.array(z.string()).default([]),
});
export type GroupDiagnostics = z.infer<typeof GroupDiagnosticsSchema>;

/** Group-creation wizard payloads (FRONTEND_PLAN.md §6.3, §7.1). */
export const WomGroupPreviewSchema = z.object({
  wom_id: z.number().int(),
  name: z.string(),
  member_count: z.number().int(),
  already_registered: z.boolean(),
});
export type WomGroupPreview = z.infer<typeof WomGroupPreviewSchema>;

export const GuildStatusSchema = z.object({
  guild_id: z.string(),
  bot_present: z.boolean(),
  owns_group: z.boolean(),
  group_id: z.number().int().nullable(),
});
export type GuildStatus = z.infer<typeof GuildStatusSchema>;

export const CreateGroupInputSchema = z.object({
  name: z.string().min(1).max(100),
  wom_id: z.number().int().positive(),
  guild_id: z.string().min(1),
  discord_url: z.string().url().optional().or(z.literal("")),
});
export type CreateGroupInput = z.infer<typeof CreateGroupInputSchema>;

/**
 * Group recurring subscriptions / upgrades (FRONTEND_PLAN.md §14.1 `/Upgrades/`,
 * §9 "group upgrade status"). Replaces the points-based feature store: a group
 * subscribes to a recurring tier; billing lifecycle lives in the backend.
 */
export const SubscriptionTierSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().optional(),
  /** Price in minor currency units (e.g. cents) per interval. */
  price_cents: z.number().int().nonnegative(),
  currency: z.string().default("USD"),
  interval: z.enum(["month", "year"]).default("month"),
  /** Human-readable perks for the tier card. */
  features: z.array(z.string()).default([]),
  recommended: z.boolean().default(false),
});
export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>;

export const SubscriptionStatus = [
  "none",
  "active",
  "trialing",
  "past_due",
  "canceled",
  "expired",
] as const;

export const GroupSubscriptionSchema = z.object({
  group_id: z.number().int(),
  /** Active tier key, or null when on the free plan. */
  tier_key: z.string().nullable(),
  status: z.enum(SubscriptionStatus),
  provider: z.enum(["patreon", "stripe", "manual"]).nullable(),
  /** Unix seconds when the current paid period ends / renews. */
  current_period_end: z.number().int().nullable(),
  /** When true, the subscription ends at `current_period_end` (not renewing). */
  cancel_at_period_end: z.boolean().default(false),
});
export type GroupSubscription = z.infer<typeof GroupSubscriptionSchema>;

/** Provider-hosted checkout/billing redirect. `url` is null when unavailable. */
export const CheckoutSessionSchema = z.object({ url: z.string().nullable() });
export type CheckoutSession = z.infer<typeof CheckoutSessionSchema>;

/** Editable tier definition for superadmin tier management (FRONTEND_PLAN.md §9). */
export const SubscriptionTierInputSchema = SubscriptionTierSchema;
export type SubscriptionTierInput = z.infer<typeof SubscriptionTierInputSchema>;

/**
 * Superadmin: backend service control (FRONTEND_PLAN.md §9, §14.1
 * `ServiceManagement`). The three managed units.
 */
export const SERVICE_UNITS = [
  "droptracker-core",
  "droptracker-api",
  "droptracker-webhooks",
] as const;

export const ServiceStatusSchema = z.object({
  unit: z.string(),
  name: z.string(),
  status: z.enum(["running", "stopped", "failed", "unknown"]),
  active: z.boolean(),
  /** Unix seconds since the current state began. */
  since: z.number().int().nullable(),
});
export type ServiceStatus = z.infer<typeof ServiceStatusSchema>;

export const ServiceActionSchema = z.object({
  action: z.enum(["start", "stop", "restart"]),
});
export type ServiceAction = z.infer<typeof ServiceActionSchema>;

export const ServiceLogsSchema = z.object({
  unit: z.string(),
  lines: z.array(z.string()),
});
export type ServiceLogs = z.infer<typeof ServiceLogsSchema>;

/** Superadmin Discord message sender (FRONTEND_PLAN.md §14.1 actionSendMessage). */
export const DiscordSendInputSchema = z.object({
  channel_id: z.string().min(1),
  content: z.string().min(1).max(2000),
});
export type DiscordSendInput = z.infer<typeof DiscordSendInputSchema>;

/** Superadmin cross-content lookup (FRONTEND_PLAN.md §9, §14.1 Lookup). */
export const LOOKUP_CATEGORIES = [
  "player",
  "group",
  "drop",
  "clog",
  "pb",
  "ca",
  "pet",
  "item",
  "npc",
] as const;

export const AdminLookupResultSchema = z.object({
  category: z.enum(LOOKUP_CATEGORIES),
  id: z.string(),
  label: z.string(),
  detail: z.string().optional(),
  href: z.string().optional(),
});
export type AdminLookupResult = z.infer<typeof AdminLookupResultSchema>;

export const AdminLookupResponseSchema = z.object({
  results: z.array(AdminLookupResultSchema),
});
export type AdminLookupResponse = z.infer<typeof AdminLookupResponseSchema>;

/**
 * Native lootboard data (FRONTEND_PLAN.md §12) — live loot rendered in React
 * instead of a generated PNG. The image generator stays available as a
 * "share" affordance via `generated_image_url` / the generate endpoint.
 */
export const LootItemSchema = z.object({
  item_id: z.number().int(),
  name: z.string(),
  quantity: z.number().int(),
  /** Total value for this row (unit value × quantity). */
  value: MoneySchema,
  icon_url: z.string().optional(),
});
export type LootItem = z.infer<typeof LootItemSchema>;

export const LootboardSchema = z.object({
  group_id: z.number().int(),
  period: z.string(),
  total: MoneySchema,
  items: z.array(LootItemSchema),
});
export type Lootboard = z.infer<typeof LootboardSchema>;

/** Result of the legacy image generator (wraps the existing CLI). */
export const LootboardImageSchema = z.object({ url: z.string().nullable() });
export type LootboardImage = z.infer<typeof LootboardImageSchema>;

/**
 * Events system (FRONTEND_PLAN.md §14.1 `/Events/`, §6.1/§6.3) — events with
 * typed tasks, teams, and optional bingo boards. Entity-heavy; this is the
 * Phase 6 surface the front-end consumes.
 */
export const EVENT_TASK_TYPES = [
  "item_collection",
  "kc_target",
  "xp_target",
  "ehp_target",
  "ehb_target",
  "pb_target",
  "skill_target",
] as const;

export const EventTaskSchema = z.object({
  id: z.number().int(),
  type: z.enum(EVENT_TASK_TYPES),
  label: z.string(),
  /** e.g. boss/skill/item name the task is scoped to. */
  target: z.string().optional(),
  /** Numeric goal (kc, xp, level, seconds…), interpreted per `type`. */
  target_value: z.number().int().optional(),
  points: z.number().int().default(0),
});
export type EventTask = z.infer<typeof EventTaskSchema>;

export const EventTeamSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  score: z.number().int().default(0),
  member_count: z.number().int().default(0),
});
export type EventTeam = z.infer<typeof EventTeamSchema>;

export const BingoCellSchema = z.object({
  index: z.number().int(),
  label: z.string(),
  task_id: z.number().int().nullable().optional(),
  /** Team (or player) names that have completed this cell. */
  completed_by: z.array(z.string()).default([]),
});
export type BingoCell = z.infer<typeof BingoCellSchema>;

export const BingoBoardSchema = z.object({
  /** Board is `size` × `size`. */
  size: z.number().int(),
  cells: z.array(BingoCellSchema),
});
export type BingoBoard = z.infer<typeof BingoBoardSchema>;

export const EVENT_STATUS = ["draft", "active", "past"] as const;

export const EventSummarySchema = z.object({
  id: z.number().int(),
  group_id: z.number().int().nullable(),
  name: z.string(),
  description: z.string().optional(),
  status: z.enum(EVENT_STATUS),
  starts_at: z.number().int().nullable(),
  ends_at: z.number().int().nullable(),
  has_bingo: z.boolean().default(false),
});
export type EventSummary = z.infer<typeof EventSummarySchema>;

export const EventDetailSchema = EventSummarySchema.extend({
  tasks: z.array(EventTaskSchema).default([]),
  teams: z.array(EventTeamSchema).default([]),
  bingo: BingoBoardSchema.nullable().optional(),
});
export type EventDetail = z.infer<typeof EventDetailSchema>;

export const EventInputSchema = z.object({
  group_id: z.number().int(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  starts_at: z.number().int().nullable().optional(),
  ends_at: z.number().int().nullable().optional(),
});
export type EventInput = z.infer<typeof EventInputSchema>;

export const EventTaskInputSchema = z.object({
  type: z.enum(EVENT_TASK_TYPES),
  label: z.string().min(1),
  target: z.string().optional(),
  target_value: z.number().int().nonnegative().optional(),
  points: z.number().int().nonnegative().default(0),
});
export type EventTaskInput = z.infer<typeof EventTaskInputSchema>;

export const EventTeamInputSchema = z.object({ name: z.string().min(1).max(80) });
export type EventTeamInput = z.infer<typeof EventTeamInputSchema>;

export * from "./group-config";
