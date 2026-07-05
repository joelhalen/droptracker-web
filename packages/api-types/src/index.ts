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
import { GroupEntitlementsSchema, TierEntitlementsSchema } from "./entitlements";

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

/** Must stay in lockstep with BADGE_TONES in apps/web/components/ui.tsx. */
export const BadgeToneSchema = z.enum([
  "gold",
  "green",
  "red",
  "neutral",
  "purple",
  "sky",
  "ember",
  "bronze",
]);
export type BadgeTone = z.infer<typeof BadgeToneSchema>;

/** Compact chip embedded on leaderboard rows (server sends up to 6; the UI
 * shows the first few with a "+N" overflow). `context` carries the award's
 * specifics (day / npc / team size) so chips can read "Daily Loot Champion
 * (Jul 3, 2026)" rather than looking identical across players. */
export const CompactBadgeSchema = z.object({
  key: z.string(),
  label: z.string(),
  tone: BadgeToneSchema.catch("neutral"),
  emoji: z.string().nullable().optional(),
  icon_url: z.string().nullable().optional(),
  count: z.number().int().optional(),
  context: z.record(z.unknown()).nullable().optional(),
});
export type CompactBadge = z.infer<typeof CompactBadgeSchema>;

/** A player's badge award as shown on their profile. */
export const PlayerBadgeSchema = z.object({
  id: z.number().int(),
  key: z.string(),
  name: z.string(),
  description: z.string(),
  icon_url: z.string().nullable().optional(),
  icon_emoji: z.string().nullable().optional(),
  tone: BadgeToneSchema.catch("neutral"),
  semantic: z.enum(["permanent", "held"]),
  status: z.enum(["active", "lost", "revoked"]),
  awarded_at_ts: z.number().int().nullable(),
  lost_at_ts: z.number().int().nullable().optional(),
  context: z.record(z.unknown()).nullable().optional(),
});
export type PlayerBadge = z.infer<typeof PlayerBadgeSchema>;

export const BadgeDefinitionSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  icon_url: z.string().nullable().optional(),
  icon_emoji: z.string().nullable().optional(),
  tone: BadgeToneSchema.catch("neutral"),
  semantic: z.enum(["permanent", "held"]),
});
export type BadgeDefinition = z.infer<typeof BadgeDefinitionSchema>;

export const AdminBadgeSchema = BadgeDefinitionSchema.extend({
  active: z.boolean(),
  automatic: z.boolean(),
  criteria: z.string().nullable().optional(),
  active_awards: z.number().int().default(0),
});
export type AdminBadge = z.infer<typeof AdminBadgeSchema>;

export const AdminBadgeInputSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/, "snake_case identifier"),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(300),
  tone: BadgeToneSchema,
  semantic: z.enum(["permanent", "held"]).default("permanent"),
  icon_url: z.string().max(512).optional(),
  icon_emoji: z.string().max(16).optional(),
  active: z.boolean().default(true),
});
export type AdminBadgeInput = z.infer<typeof AdminBadgeInputSchema>;

export const LeaderboardEntrySchema = z.object({
  rank: z.number().int(),
  id: z.number().int(),
  name: z.string(),
  loot: MoneySchema,
  delta: z.number().int().optional(),
  badges: z.array(CompactBadgeSchema).optional(),
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
  quantity: z.number().int().optional(),
  /** Item/NPC icon (`/img/itemdb/{id}.png` or `/img/npcdb/{id}.png`), not a proof screenshot. */
  image_url: z.string().optional(),
  npc_name: z.string().nullable().optional(),
  /** Who received this submission — populated on group-scope listings. */
  player_id: z.number().int().nullable().optional(),
  player_name: z.string().nullable().optional(),
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
  badges: z.array(PlayerBadgeSchema).optional(),
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
  type: z.enum(["drop", "leaderboard_delta", "announcement", "submission", "event_update"]),
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

/** Docs CMS (superadmin-editable, replaces the old static .mdx files). */
export const DocSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  category: z.string(),
  order: z.number().int(),
});
export type DocSummary = z.infer<typeof DocSummarySchema>;

export const DocSchema = DocSummarySchema.extend({
  content: z.string(),
});
export type Doc = z.infer<typeof DocSchema>;

export const DocInputSchema = z.object({
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  description: z.string().max(300).nullable().optional(),
  category: z.string().min(1).max(80),
  order: z.number().int().default(100),
  content: z.string().min(1),
});
export type DocInput = z.infer<typeof DocInputSchema>;

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
  /** Machine-readable capabilities (runtime access control). */
  entitlements: TierEntitlementsSchema.default({}),
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
  /** Resolved capabilities for this group's active tier (present on Web API reads). */
  entitlements: GroupEntitlementsSchema.optional(),
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
 * Superadmin site overview KPIs (dashboard landing). Flexible tiles: each stat
 * has a machine `key`, human `label`, numeric `value`, and optional `hint`.
 */
export const AdminOverviewStatSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number().int(),
  hint: z.string().optional(),
});
export type AdminOverviewStat = z.infer<typeof AdminOverviewStatSchema>;

export const AdminOverviewSchema = z.object({
  stats: z.array(AdminOverviewStatSchema),
  generated_at: z.number().int(),
});
export type AdminOverview = z.infer<typeof AdminOverviewSchema>;

/** Comped (manual) subscription grant input (§12). */
export const AdminSubscriptionGrantInputSchema = z.object({
  tier_key: z.string().min(1),
  days: z.number().int().positive().max(3650),
});
export type AdminSubscriptionGrantInput = z.infer<typeof AdminSubscriptionGrantInputSchema>;

/**
 * Superadmin curated data viewer/editor (§12). Whitelisted entities only — there
 * is deliberately no arbitrary SQL executor.
 */
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

/** A single row is an open record of column → JSON-safe scalar. */
export const AdminDataRowSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);
export type AdminDataRow = z.infer<typeof AdminDataRowSchema>;

export const AdminDataListResponseSchema = z.object({
  entity: z.string(),
  columns: z.array(z.string()),
  rows: z.array(AdminDataRowSchema),
  editable: z.array(z.string()),
  meta: PageMetaSchema,
});
export type AdminDataListResponse = z.infer<typeof AdminDataListResponseSchema>;

export const AdminDataRecordResponseSchema = z.object({
  entity: z.string(),
  id: z.union([z.string(), z.number()]),
  record: AdminDataRowSchema,
  editable: z.array(z.string()),
});
export type AdminDataRecordResponse = z.infer<typeof AdminDataRecordResponseSchema>;

/** PATCH body: only allowlisted editable columns are accepted (422 otherwise). */
export const AdminDataPatchInputSchema = z.object({
  fields: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  ),
});
export type AdminDataPatchInput = z.infer<typeof AdminDataPatchInputSchema>;

/** Application log tail (§12) — from the `logs` analytics table. */
export const AdminLogEntrySchema = z.object({
  ts: z.number().int(),
  level: z.string(),
  source: z.string(),
  message: z.string(),
});
export type AdminLogEntry = z.infer<typeof AdminLogEntrySchema>;

export const AdminLogsResponseSchema = z.object({
  entries: z.array(AdminLogEntrySchema),
  sources: z.array(z.string()),
});
export type AdminLogsResponse = z.infer<typeof AdminLogsResponseSchema>;

/** Superadmin per-group staff overview (§12). */
export const AdminGroupOverviewSchema = z.object({
  group: z.object({
    id: z.number().int(),
    name: z.string(),
    member_count: z.number().int(),
    guild_id: z.string().nullable(),
    wom_id: z.number().int().nullable(),
  }),
  subscription: GroupSubscriptionSchema,
  config_summary: z.record(z.string(), z.string().nullable()),
  activity_7d: z.array(z.object({ date: z.string(), submissions: z.number().int() })),
  last_submission_ts: z.number().int().nullable(),
  warnings: z.array(z.string()).default([]),
});
export type AdminGroupOverview = z.infer<typeof AdminGroupOverviewSchema>;

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
  /** True for the coin pile (item 995) — value only, no quantity label. */
  is_coin: z.boolean().optional(),
});
export type LootItem = z.infer<typeof LootItemSchema>;

/** A high-value recent drop shown in the board's bottom panel. */
export const LootboardRecentDropSchema = z.object({
  item_id: z.number().int(),
  name: z.string(),
  icon_url: z.string().optional(),
  player_id: z.number().int(),
  player_name: z.string(),
  quantity: z.number().int(),
  value: MoneySchema,
  /** ISO-ish timestamp string ("YYYY-MM-DD HH:MM:SS"). */
  date_added: z.string().nullable().optional(),
});
export type LootboardRecentDrop = z.infer<typeof LootboardRecentDropSchema>;

/** A leaderboard row shown in the board's left panel. */
export const LootboardLeaderboardRowSchema = z.object({
  rank: z.number().int(),
  player_id: z.number().int(),
  player_name: z.string(),
  total: MoneySchema,
});
export type LootboardLeaderboardRow = z.infer<typeof LootboardLeaderboardRowSchema>;

export const LootboardSchema = z.object({
  group_id: z.number().int(),
  period: z.string(),
  total: MoneySchema,
  items: z.array(LootItemSchema),
  /**
   * Native board fields (mirrors the PIL generator). Optional so older API
   * responses / mocks that only carry `items` still validate; when present the
   * front-end renders the 1:1 template board instead of the fallback grid.
   */
  background_url: z.string().optional(),
  canvas: z.object({ width: z.number(), height: z.number() }).optional(),
  header: z.string().optional(),
  use_gp_colors: z.boolean().optional(),
  use_dynamic_colors: z.boolean().optional(),
  recent_drops: z.array(LootboardRecentDropSchema).optional(),
  leaderboard: z.array(LootboardLeaderboardRowSchema).optional(),
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
  /** Manual-confirmation-only tasks (no automated evaluation). */
  "custom",
] as const;

/** How players get onto teams (events-prd.md D4). */
export const EVENT_FORMATION_MODES = ["self_join", "auto_assign", "admin_assign"] as const;

/** Ledger row lifecycle for event completions (events-prd.md D3). */
export const EVENT_COMPLETION_STATUSES = [
  "auto",
  "pending",
  "confirmed",
  "rejected",
  "manual",
  "revoked",
] as const;

/** Per-event Discord destination kinds (events-prd.md D8). */
export const EVENT_CHANNEL_KINDS = ["announcements", "completions", "leaderboard", "admin"] as const;

/** Square bingo boards only; 5×5 is the default. */
export const EVENT_BOARD_SIZES = [3, 4, 5, 6, 7] as const;

export const EventTaskSchema = z.object({
  id: z.number().int(),
  type: z.enum(EVENT_TASK_TYPES),
  label: z.string(),
  /** e.g. boss/skill/item name the task is scoped to. */
  target: z.string().optional(),
  /** Numeric goal (kc, xp, level, seconds…), interpreted per `type`. */
  target_value: z.number().int().optional(),
  points: z.number().int().default(0),
  /** Completions of this task queue for admin review instead of auto-applying. */
  requires_confirmation: z.boolean().default(false),
  /** JSON string: any_of/assembly/point_collection item lists etc. */
  config: z.string().nullable().optional(),
});
export type EventTask = z.infer<typeof EventTaskSchema>;

/** Roster entry. `joined_at` (unix) is the credit cutoff (events-prd.md D10). */
export const EventMemberSchema = z.object({
  player_id: z.number().int(),
  player_name: z.string(),
  joined_at: z.number().int().nullable(),
});
export type EventMember = z.infer<typeof EventMemberSchema>;

export const EventTeamSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  score: z.number().int().default(0),
  member_count: z.number().int().default(0),
  /** Present on EventDetail reads (Task 16); absent on legacy payloads. */
  members: z.array(EventMemberSchema).optional(),
});
export type EventTeam = z.infer<typeof EventTeamSchema>;

/** One team's (or player's) completion of a cell, with enough context for the
 * public board's popover (who + when). `completed_at` comes from the task's
 * progress rollup; free cells have none. */
export const BingoCellCompletionSchema = z.object({
  team_id: z.number().int().nullable().optional(),
  team_name: z.string().nullable().optional(),
  player_id: z.number().int().nullable().optional(),
  player_name: z.string().nullable().optional(),
  completed_at: z.number().int().nullable().optional(),
});
export type BingoCellCompletion = z.infer<typeof BingoCellCompletionSchema>;

export const BingoCellSchema = z.object({
  index: z.number().int(),
  label: z.string(),
  task_id: z.number().int().nullable().optional(),
  /** Team (or player) names that have completed this cell. */
  completed_by: z.array(z.string()).default([]),
  /** Structured per-team completion state (Task 20 live board). */
  completions: z.array(BingoCellCompletionSchema).optional(),
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
  formation_mode: z.enum(EVENT_FORMATION_MODES).default("admin_assign"),
  /** Event-level force: all completions queue for admin review. */
  requires_confirmation: z.boolean().default(false),
  board_size: z.number().int().default(5),
  bonus_line_points: z.number().int().default(0),
  bonus_blackout_points: z.number().int().default(0),
  activated_at: z.number().int().nullable().optional(),
  ended_at: z.number().int().nullable().optional(),
});
export type EventSummary = z.infer<typeof EventSummarySchema>;

/** The signed-in viewer's stake in an event (Task 16). */
export const EventViewerSchema = z.object({
  /** Ids of the viewer's linked players already on a team in this event. */
  player_ids_on_event: z.array(z.number().int()).default([]),
  /** Team of the viewer's first joined player, if any. */
  team_id: z.number().int().nullable().optional(),
});
export type EventViewer = z.infer<typeof EventViewerSchema>;

export const EventDetailSchema = EventSummarySchema.extend({
  tasks: z.array(EventTaskSchema).default([]),
  teams: z.array(EventTeamSchema).default([]),
  bingo: BingoBoardSchema.nullable().optional(),
  /** Present (possibly null) for signed-in requesters; null when signed out. */
  viewer: EventViewerSchema.nullable().optional(),
  /** True when self-join requires a join code (the code itself never appears
   * on public reads). */
  join_requires_code: z.boolean().default(false),
  /** Admin-only: present only when the requester administers the event. */
  join_code: z.string().nullable().optional(),
  discord_guild_id: z.string().nullable().optional(),
});
export type EventDetail = z.infer<typeof EventDetailSchema>;

export const EventInputSchema = z.object({
  /** null ⇒ global event (superadmin only). */
  group_id: z.number().int().nullable(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  starts_at: z.number().int().nullable().optional(),
  ends_at: z.number().int().nullable().optional(),
  formation_mode: z.enum(EVENT_FORMATION_MODES).optional(),
  requires_confirmation: z.boolean().optional(),
  join_code: z.string().max(32).nullable().optional(),
  board_size: z.number().int().min(3).max(7).optional(),
  bonus_line_points: z.number().int().nonnegative().optional(),
  bonus_blackout_points: z.number().int().nonnegative().optional(),
});
export type EventInput = z.infer<typeof EventInputSchema>;

export const EventTaskInputSchema = z.object({
  type: z.enum(EVENT_TASK_TYPES),
  label: z.string().min(1),
  target: z.string().optional(),
  target_value: z.number().int().nonnegative().optional(),
  points: z.number().int().nonnegative().default(0),
  requires_confirmation: z.boolean().optional(),
  /** JSON string: any_of/assembly/point_collection item lists etc. */
  config: z.string().nullable().optional(),
});
export type EventTaskInput = z.infer<typeof EventTaskInputSchema>;

/** PATCH /events/{id}/tasks/{taskId} — partial task edit (Task 18). */
export const EventTaskPatchSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  target: z.string().nullable().optional(),
  target_value: z.number().int().nonnegative().nullable().optional(),
  points: z.number().int().nonnegative().optional(),
  requires_confirmation: z.boolean().optional(),
});
export type EventTaskPatch = z.infer<typeof EventTaskPatchSchema>;

/** POST /events/{id}/award — manual ledger row + immediate apply (events-prd.md
 * D10: the retro-credit escape hatch; also completes custom/ehp/ehb tasks). */
export const EventAwardInputSchema = z.object({
  task_id: z.number().int(),
  team_id: z.number().int(),
  quantity: z.number().int().positive().optional(),
  note: z.string().max(255).optional(),
});
export type EventAwardInput = z.infer<typeof EventAwardInputSchema>;

/** POST /events/{id}/revoke — revoke an applied (auto/confirmed/manual) ledger
 * row; the engine recomputes progress/score/bingo from surviving rows. */
export const EventRevokeInputSchema = z.object({
  completion_id: z.number().int(),
  note: z.string().max(255).optional(),
});
export type EventRevokeInput = z.infer<typeof EventRevokeInputSchema>;

/** Ledger entry: one qualifying submission or manual admin action. */
export const EventCompletionSchema = z.object({
  id: z.number().int(),
  event_id: z.number().int(),
  task_id: z.number().int(),
  task_label: z.string().nullable().optional(),
  team_id: z.number().int().nullable(),
  team_name: z.string().nullable().optional(),
  player_id: z.number().int().nullable(),
  player_name: z.string().nullable().optional(),
  status: z.enum(EVENT_COMPLETION_STATUSES),
  quantity: z.number().int().default(1),
  source_type: z.string().nullable().optional(),
  submission_guid: z.string().nullable().optional(),
  proof_url: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  created_at: z.number().int(),
});
export type EventCompletion = z.infer<typeof EventCompletionSchema>;

/** Per-(task, team) rollup driven by the completion engine. */
export const EventProgressSchema = z.object({
  task_id: z.number().int(),
  team_id: z.number().int(),
  progress: z.number().int().default(0),
  completed: z.boolean().default(false),
  completed_at: z.number().int().nullable().optional(),
});
export type EventProgress = z.infer<typeof EventProgressSchema>;

/** Per-event Discord destinations (events-prd.md D8). */
export const EventChannelConfigSchema = z.object({
  guild_id: z.string().nullable(),
  guild_name: z.string().nullable().optional(),
  channels: z.record(z.enum(EVENT_CHANNEL_KINDS), z.string()).default({}),
});
export type EventChannelConfig = z.infer<typeof EventChannelConfigSchema>;

/** One notification-destination kind (announcements/completions/leaderboard/admin). */
export type EventChannelKind = (typeof EVENT_CHANNEL_KINDS)[number];

/** PUT /events/{id}/discord — set (or clear, with guild_id null) the event's
 * Discord destination. Snowflakes travel as digit strings. */
export const EventChannelConfigInputSchema = z.object({
  guild_id: z.string().regex(/^\d+$/, "Discord ids are numeric").nullable(),
  channels: z.record(z.enum(EVENT_CHANNEL_KINDS), z.string().regex(/^\d+$/)).default({}),
});
export type EventChannelConfigInput = z.infer<typeof EventChannelConfigInputSchema>;

/** Curated task preset from the library (seeded from the legacy task store). */
export const EventTaskLibraryItemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable().optional(),
  type: z.enum(EVENT_TASK_TYPES),
  target: z.string().nullable().optional(),
  target_value: z.number().int().nullable().optional(),
  default_points: z.number().int().default(0),
  difficulty: z.string().nullable().optional(),
  config: z.string().nullable().optional(),
});
export type EventTaskLibraryItem = z.infer<typeof EventTaskLibraryItemSchema>;

/** One designer cell for PUT /events/{id}/bingo. Exactly one of `task_id`
 * (existing event task) / `library_item_id` (copy a preset into the event's
 * tasks) / `new_task` (create inline) — or none of them for a free cell. */
export const BingoCellInputSchema = z
  .object({
    idx: z.number().int().nonnegative(),
    /** Display label; defaults to the bound task's label ("Free space" for
     * free cells) when omitted. */
    label: z.string().max(255).optional(),
    task_id: z.number().int().optional(),
    library_item_id: z.number().int().optional(),
    new_task: EventTaskInputSchema.optional(),
    /** Points override for a library pick (defaults to the preset's
     * default_points). */
    points: z.number().int().nonnegative().optional(),
  })
  .superRefine((cell, ctx) => {
    const bindings = [cell.task_id, cell.library_item_id, cell.new_task].filter(
      (v) => v != null,
    ).length;
    if (bindings > 1) {
      ctx.addIssue({
        code: "custom",
        message:
          "Each cell takes exactly one of task_id, library_item_id or new_task — or none for a free cell.",
      });
    }
  });
export type BingoCellInput = z.infer<typeof BingoCellInputSchema>;

/** PUT /events/{id}/bingo — replaces the whole board (drafts / not-started
 * events only; the API answers 409 once the event has started). */
export const BingoBoardInputSchema = z
  .object({
    size: z.number().int().refine((n) => (EVENT_BOARD_SIZES as readonly number[]).includes(n), {
      message: `size must be one of ${EVENT_BOARD_SIZES.join(", ")}`,
    }),
    cells: z.array(BingoCellInputSchema),
  })
  .superRefine((board, ctx) => {
    if (board.cells.length !== board.size * board.size) {
      ctx.addIssue({
        code: "custom",
        message: `A ${board.size}×${board.size} board needs exactly ${board.size * board.size} cells.`,
      });
      return;
    }
    const idxs = new Set(board.cells.map((c) => c.idx));
    if (idxs.size !== board.cells.length || [...idxs].some((i) => i < 0 || i >= board.cells.length)) {
      ctx.addIssue({
        code: "custom",
        message: `Cell idx values must cover 0…${board.cells.length - 1} exactly once.`,
      });
    }
  });
export type BingoBoardInput = z.infer<typeof BingoBoardInputSchema>;

export const EventTeamInputSchema = z.object({ name: z.string().min(1).max(80) });
export type EventTeamInput = z.infer<typeof EventTeamInputSchema>;

/** POST /events/{id}/join (Task 16). `team_id` is required for self_join
 * events with more than one team and forbidden for auto_assign. */
export const EventJoinInputSchema = z.object({
  player_id: z.number().int(),
  team_id: z.number().int().optional(),
  join_code: z.string().max(32).optional(),
});
export type EventJoinInput = z.infer<typeof EventJoinInputSchema>;

/** POST /events/{id}/leave and admin roster add (Task 16). */
export const EventMemberInputSchema = z.object({ player_id: z.number().int() });
export type EventMemberInput = z.infer<typeof EventMemberInputSchema>;

export * from "./group-config";
export * from "./entitlements";
