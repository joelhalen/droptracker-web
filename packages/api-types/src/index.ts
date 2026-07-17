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
import {
  GroupEntitlementsSchema,
  TierEntitlementsSchema,
  UserEntitlementsSchema,
} from "./entitlements";
import { GroupFlairSchema, TierFlairSchema } from "./tier-flair";

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

// --- Item value overrides (post-submission "component of X, worth Y" rules) ---
export const ItemValueComponentSchema = z.object({
  item_id: z.number().int().nullable().optional(),
  item_name: z.string(),
  quantity: z.number().int(),
  /** Present on API reads: ``/img/itemdb/{id}.png``. */
  icon_url: z.string().nullable().optional(),
});
export type ItemValueComponent = z.infer<typeof ItemValueComponentSchema>;

/** One override row from the admin list (includes a live computed preview). */
export const ItemValueOverrideSchema = z.object({
  id: z.number().int(),
  item_id: z.number().int().nullable(),
  item_name: z.string(),
  icon_url: z.string().nullable().optional(),
  divisor: z.number().int(),
  flat_bonus: z.number().int(),
  fallback_value: z.number().int(),
  components: z.array(ItemValueComponentSchema),
  description: z.string().nullable().optional(),
  active: z.boolean(),
  updated_at: z.string().nullable().optional(),
  computed_value: z.number().int().nullable().optional(),
});
export type ItemValueOverride = z.infer<typeof ItemValueOverrideSchema>;

export const ItemValueComponentInputSchema = z.object({
  item_id: z.number().int().nullable().optional(),
  item_name: z.string().min(1).max(125),
  quantity: z
    .number()
    .int()
    .refine((n) => n !== 0, "quantity must be non-zero"),
});
export type ItemValueComponentInput = z.infer<typeof ItemValueComponentInputSchema>;

/** Create/update payload for an override. */
export const ItemValueOverrideInputSchema = z.object({
  item_id: z.number().int().nullable().optional(),
  item_name: z.string().min(1).max(125),
  divisor: z.number().int().min(1).default(1),
  flat_bonus: z.number().int().default(0),
  fallback_value: z.number().int().min(0).default(0),
  components: z.array(ItemValueComponentInputSchema).default([]),
  description: z.string().max(255).optional(),
  active: z.boolean().default(true),
});
export type ItemValueOverrideInput = z.infer<typeof ItemValueOverrideInputSchema>;

/** Item search hit for the component picker. */
export const ItemSearchResultSchema = z.object({
  item_id: z.number().int(),
  item_name: z.string(),
});
export type ItemSearchResult = z.infer<typeof ItemSearchResultSchema>;

/** Public /item-values row: live valuation + human-readable formula. */
export const PublicItemValueSchema = z.object({
  item_id: z.number().int().nullable(),
  item_name: z.string(),
  icon_url: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  formula: z.string(),
  components: z.array(ItemValueComponentSchema),
  value: MoneySchema,
  priced: z.boolean(),
});
export type PublicItemValue = z.infer<typeof PublicItemValueSchema>;

export const LeaderboardEntrySchema = z.object({
  rank: z.number().int(),
  id: z.number().int(),
  name: z.string(),
  loot: MoneySchema,
  delta: z.number().int().optional(),
  badges: z.array(CompactBadgeSchema).optional(),
  /** Group tier flair (groups board only; present for subscribed groups). */
  flair: GroupFlairSchema.optional(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const LeaderboardPageSchema = z.object({
  period: z.string(),
  scope: z.string(),
  entries: z.array(LeaderboardEntrySchema),
  meta: PageMetaSchema,
});
export type LeaderboardPage = z.infer<typeof LeaderboardPageSchema>;

// --- Homepage supporters wall (/supporters) -------------------------------
/** A clan whose live subscription pool covers a paid tier. `since` is the unix
 *  timestamp of its most recent contribution; `flair` present for flaired tiers. */
export const SupporterGroupSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  tier_name: z.string(),
  member_count: z.number().int(),
  since: z.number().int().nullable(),
  flair: GroupFlairSchema.optional(),
});
export type SupporterGroup = z.infer<typeof SupporterGroupSchema>;

/** An individual with a live paid supporter subscription, represented by a
 *  public (non-hidden) linked player so the card can link to a profile. */
export const SupporterPlayerSchema = z.object({
  user_id: z.number().int(),
  player_id: z.number().int(),
  name: z.string(),
  since: z.number().int().nullable(),
});
export type SupporterPlayer = z.infer<typeof SupporterPlayerSchema>;

export const SupportersSchema = z.object({
  groups: z.array(SupporterGroupSchema),
  players: z.array(SupporterPlayerSchema),
});
export type Supporters = z.infer<typeof SupportersSchema>;

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
  /** Dropped/logged item id — links the label to `/items/{id}` where present. */
  item_id: z.number().int().nullable().optional(),
  /** Source NPC id — links the NPC name to `/npcs/{id}` where present. */
  npc_id: z.number().int().nullable().optional(),
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
  /** Group tier flair, present for subscribed groups. */
  flair: GroupFlairSchema.optional(),
});
export type GroupMembership = z.infer<typeof GroupMembershipSchema>;

/** Most-farmed NPC this month (loot + drop count) for a player or group. */
export const TopBossSchema = z.object({
  npc_id: z.number().int(),
  name: z.string(),
  loot: MoneySchema,
  drops: z.number().int(),
});
export type TopBoss = z.infer<typeof TopBossSchema>;

export const GroupTopPlayerSchema = z.object({
  rank: z.number().int(),
  id: z.number().int(),
  name: z.string(),
  loot: MoneySchema,
});
export type GroupTopPlayer = z.infer<typeof GroupTopPlayerSchema>;

/** Fastest kill time per boss held by a group member. */
export const GroupRecordSchema = z.object({
  npc_id: z.number().int(),
  boss: z.string(),
  time_ms: z.number().int(),
  time_display: z.string(),
  team_size: z.string(),
  holder: z.object({ id: z.number().int(), name: z.string() }),
  date_ts: z.number().int(),
});
export type GroupRecord = z.infer<typeof GroupRecordSchema>;

export const PersonalBestSummarySchema = z.object({
  npc_id: z.number().int(),
  boss: z.string(),
  time_ms: z.number().int(),
  time_display: z.string(),
  team_size: z.string(),
  date_ts: z.number().int(),
});
export type PersonalBestSummary = z.infer<typeof PersonalBestSummarySchema>;

/** One stacked item inside a loot-tracker NPC box. */
export const LootTrackerItemSchema = z.object({
  item_id: z.number().int(),
  name: z.string(),
  quantity: z.number().int(),
  loot: MoneySchema,
  /** Distinct drop rows this item came from this month. */
  drops: z.number().int().optional(),
  /** Unix seconds of the first/most recent time it was received this month. */
  first_ts: z.number().int().optional(),
  last_ts: z.number().int().optional(),
});
export type LootTrackerItem = z.infer<typeof LootTrackerItemSchema>;

/** RuneLite-style loot box: one NPC's month of drops, items stacked. */
export const LootTrackerNpcSchema = z.object({
  npc_id: z.number().int(),
  name: z.string(),
  /** Distinct drop events (multi-item kills counted once). */
  kills: z.number().int(),
  loot: MoneySchema,
  items: z.array(LootTrackerItemSchema),
});
export type LootTrackerNpc = z.infer<typeof LootTrackerNpcSchema>;

export const PlayerLootTrackerSchema = z.object({
  player_id: z.number().int(),
  /** YYYYMM month shown. */
  partition: z.number().int(),
  /** First YYYYMM with tracked drops (month-picker lower bound). */
  earliest_partition: z.number().int(),
  npcs: z.array(LootTrackerNpcSchema),
});
export type PlayerLootTracker = z.infer<typeof PlayerLootTrackerSchema>;

// --- Personal-best leaderboards (/personal-bests/*) -----------------------
/** One ranked time on a (boss, team size) board. */
export const PbBoardEntrySchema = z.object({
  rank: z.number().int(),
  player_id: z.number().int(),
  player_name: z.string(),
  time_ms: z.number().int(),
  time_display: z.string(),
  date_ts: z.number().int().nullable(),
  /** Proof screenshot (droptracker-hosted only; absent otherwise). */
  image_url: z.string().optional(),
  /** Present on group-scoped boards: the entry's global standing. */
  global_rank: z.number().int().optional(),
});
export type PbBoardEntry = z.infer<typeof PbBoardEntrySchema>;

export const PbTeamBoardSchema = z.object({
  team_size: z.string(),
  size_label: z.string(),
  /** Ranked players on the full board (entries may be truncated). */
  total_players: z.number().int(),
  entries: z.array(PbBoardEntrySchema),
});
export type PbTeamBoard = z.infer<typeof PbTeamBoardSchema>;

/** All team-size boards for one boss (optionally group-scoped). */
export const PbBossBoardSchema = z.object({
  npc_id: z.number().int(),
  name: z.string(),
  icon_url: z.string(),
  entry_count: z.number().int(),
  player_count: z.number().int(),
  group_id: z.number().int().nullable(),
  group_name: z.string().nullable().optional(),
  boards: z.array(PbTeamBoardSchema),
});
export type PbBossBoard = z.infer<typeof PbBossBoardSchema>;

export const PbBossSummarySchema = z.object({
  npc_id: z.number().int(),
  name: z.string(),
  entry_count: z.number().int(),
  player_count: z.number().int(),
  /** Raid encounters pinned to the top of the index. */
  featured: z.boolean(),
  team_sizes: z.array(z.string()),
  best: z
    .object({
      time_ms: z.number().int(),
      time_display: z.string(),
      team_size: z.string(),
      player_id: z.number().int(),
      player_name: z.string(),
    })
    .nullable(),
});
export type PbBossSummary = z.infer<typeof PbBossSummarySchema>;

export const PbBossIndexSchema = z.object({
  group_id: z.number().int().nullable(),
  group_name: z.string().nullable().optional(),
  bosses: z.array(PbBossSummarySchema),
});
export type PbBossIndex = z.infer<typeof PbBossIndexSchema>;

// --- NPC pages (/npcs/{npcId}) ---------------------------------------------
/** Lifetime tracked totals for one NPC (covers the full drops history). */
export const NpcLifetimeStatsSchema = z.object({
  loot: MoneySchema,
  drop_count: z.number().int(),
  unique_players: z.number().int(),
  last_drop_ts: z.number().int().nullable().optional(),
});
export type NpcLifetimeStats = z.infer<typeof NpcLifetimeStatsSchema>;

export const NpcMonthStatsSchema = z.object({
  partition: z.number().int(),
  loot: MoneySchema,
  drop_count: z.number().int(),
  unique_players: z.number().int(),
});
export type NpcMonthStats = z.infer<typeof NpcMonthStatsSchema>;

export const NpcTopPlayerSchema = z.object({
  rank: z.number().int(),
  player_id: z.number().int(),
  player_name: z.string(),
  loot: MoneySchema,
  drop_count: z.number().int(),
});
export type NpcTopPlayer = z.infer<typeof NpcTopPlayerSchema>;

export const NpcRecentDropSchema = z.object({
  drop_id: z.number().int(),
  item_id: z.number().int().nullable(),
  item_name: z.string(),
  icon_url: z.string().nullable(),
  player_id: z.number().int(),
  player_name: z.string(),
  value: MoneySchema,
  quantity: z.number().int(),
  ts: z.number().int(),
});
export type NpcRecentDrop = z.infer<typeof NpcRecentDropSchema>;

export const NpcDetailSchema = z.object({
  npc_id: z.number().int(),
  name: z.string(),
  icon_url: z.string(),
  wiki_url: z.string(),
  /** Pretty-URL slug to declare canonical (null only if the name is unslugifiable). */
  canonical_slug: z.string().nullish(),
  lifetime: NpcLifetimeStatsSchema,
  month: NpcMonthStatsSchema,
  top_players: z.array(NpcTopPlayerSchema),
  recent_drops: z.array(NpcRecentDropSchema),
});
export type NpcDetail = z.infer<typeof NpcDetailSchema>;

/** One wiki drop-table row, annotated with who last received it from this NPC. */
export const NpcDropTableItemSchema = z.object({
  item_id: z.number().int(),
  name: z.string(),
  icon_url: z.string(),
  /** Wiki quantity spelling, e.g. "1" or "1-3". */
  quantity: z.string(),
  noted: z.boolean(),
  /** Drop probability in [0,1]; 1 = always. */
  rarity: z.number(),
  rolls: z.number().int(),
  last_drop: z
    .object({
      player_id: z.number().int(),
      player_name: z.string(),
      ts: z.number().int(),
      value: MoneySchema,
    })
    .nullable(),
});
export type NpcDropTableItem = z.infer<typeof NpcDropTableItemSchema>;

export const NpcDropTableSchema = z.object({
  npc_id: z.number().int(),
  name: z.string(),
  items: z.array(NpcDropTableItemSchema),
  /** "building" while the last-received registry cold-builds in the background. */
  last_drops_status: z.enum(["ready", "building"]),
});
export type NpcDropTable = z.infer<typeof NpcDropTableSchema>;

// --- Item pages (/items/{itemId}) ------------------------------------------
export const ItemLifetimeStatsSchema = z.object({
  loot: MoneySchema,
  quantity: z.number().int(),
  drop_count: z.number().int(),
  unique_players: z.number().int(),
  last_drop_ts: z.number().int().nullable().optional(),
});
export type ItemLifetimeStats = z.infer<typeof ItemLifetimeStatsSchema>;

export const ItemMonthStatsSchema = z.object({
  partition: z.number().int(),
  loot: MoneySchema,
  quantity: z.number().int(),
  drop_count: z.number().int(),
  unique_players: z.number().int(),
});
export type ItemMonthStats = z.infer<typeof ItemMonthStatsSchema>;

export const ItemTopReceiverSchema = z.object({
  rank: z.number().int(),
  player_id: z.number().int(),
  player_name: z.string(),
  loot: MoneySchema,
  quantity: z.number().int(),
  drop_count: z.number().int(),
});
export type ItemTopReceiver = z.infer<typeof ItemTopReceiverSchema>;

export const ItemRecentDropSchema = z.object({
  drop_id: z.number().int(),
  npc_id: z.number().int().nullable(),
  npc_name: z.string().nullable(),
  npc_icon_url: z.string().nullable(),
  player_id: z.number().int(),
  player_name: z.string(),
  value: MoneySchema,
  quantity: z.number().int(),
  ts: z.number().int(),
});
export type ItemRecentDrop = z.infer<typeof ItemRecentDropSchema>;

/** An NPC whose wiki drop table includes the item. */
export const ItemSourceSchema = z.object({
  npc_id: z.number().int(),
  name: z.string(),
  icon_url: z.string(),
  quantity: z.string(),
  rarity: z.number(),
  rolls: z.number().int(),
});
export type ItemSource = z.infer<typeof ItemSourceSchema>;

export const ItemDetailSchema = z.object({
  item_id: z.number().int(),
  name: z.string(),
  icon_url: z.string(),
  wiki_url: z.string(),
  /** Pretty-URL slug to declare canonical (null only if the name is unslugifiable). */
  canonical_slug: z.string().nullish(),
  stackable: z.boolean(),
  /** Live GE price (null when unpriced, e.g. untradeables). */
  ge_value: MoneySchema.nullable().optional(),
  /** Null while heavy aggregates cold-build (`stats_status: "building"`). */
  lifetime: ItemLifetimeStatsSchema.nullable(),
  month: ItemMonthStatsSchema.nullable(),
  top_receivers: z.array(ItemTopReceiverSchema),
  stats_status: z.enum(["ready", "building"]),
  recent_drops: z.array(ItemRecentDropSchema),
  sources: z.object({
    total: z.number().int(),
    npcs: z.array(ItemSourceSchema),
  }),
});
export type ItemDetail = z.infer<typeof ItemDetailSchema>;

export const PlayerProfileSchema = PlayerSummarySchema.extend({
  points: z.number().int().optional(),
  top_npc: z.string().optional(),
  previous_month_loot: MoneySchema.optional(),
  /** Total players on the global board, for "Top X%" percentile context. */
  ranked_players: z.number().int().optional(),
  top_bosses: z.array(TopBossSchema).optional(),
  personal_bests: z.array(PersonalBestSummarySchema).optional(),
  groups: z.array(GroupMembershipSchema).default([]),
  recent_submissions: z.array(SubmissionSchema).default([]),
  badges: z.array(PlayerBadgeSchema).optional(),
  /** Owner has an active supporter subscription (display flair). */
  is_supporter: z.boolean().optional(),
  /** Pretty-URL slug to declare canonical (null when the RSN collides with another visible player). */
  canonical_slug: z.string().nullish(),
});
export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;

export const GroupProfileSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().optional(),
  /** Admin-uploaded group icon; also used for social-card previews. */
  icon_url: z.string().optional(),
  member_count: z.number().int(),
  global_rank: z.number().int().optional(),
  monthly_loot: MoneySchema.optional(),
  discord_url: z.string().optional(),
  top_player: PlayerSummarySchema.optional(),
  top_players: z.array(GroupTopPlayerSchema).optional(),
  top_bosses: z.array(TopBossSchema).optional(),
  records: z.array(GroupRecordSchema).optional(),
  recent_submissions: z.array(SubmissionSchema).default([]),
  /** Group tier flair, present for subscribed groups. */
  flair: GroupFlairSchema.optional(),
  /** Pretty-URL slug to declare canonical (null when the name collides with another group). */
  canonical_slug: z.string().nullish(),
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
  /** Trusted helper: unlocks the /moderation panel (superadmin implies it). */
  is_moderator: z.boolean().default(false),
  /** Active supporter subscription (user-level premium flair/perks). */
  is_supporter: z.boolean().default(false),
  players: z.array(PlayerSummarySchema).default([]),
  groups: z
    .array(
      z.object({
        id: z.number().int(),
        name: z.string(),
        role: z.enum(["owner", "admin", "member"]),
        /** Group tier flair, present for subscribed groups. */
        flair: GroupFlairSchema.optional(),
      }),
    )
    .default([]),
});
export type Me = z.infer<typeof MeSchema>;

/** Realtime SSE event envelope (FRONTEND_PLAN.md §8.3). */
export const RealtimeEventSchema = z.object({
  v: z.literal(1),
  type: z.enum([
    "drop",
    "leaderboard_delta",
    "announcement",
    "submission",
    "event_update",
    // Site-wide ticker types (backend services/realtime.py feed publishers).
    "personal_best",
    "pet",
    "group_created",
    "new_player",
    "subscription",
  ]),
  scope: z.string(),
  ts: z.number().int(),
  data: z.record(z.string(), z.unknown()),
});
export type RealtimeEvent = z.infer<typeof RealtimeEventSchema>;

/**
 * Account settings (GET /api/v1/me/settings, PATCH /api/v1/me).
 * Every field here is enforced by the backend: `hidden` removes the user's
 * accounts from public leaderboards/search/profiles/feed, the ping trio gates
 * Discord @-mentions, and `dm_account_changes` gates the RSN-change DM
 * (stored in user_configurations, shared with the bot's /dm-settings).
 * `players` lists linked accounts with their per-account visibility
 * (PATCH /api/v1/me/players/{id}).
 */
export const SettingsPlayerSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  hidden: z.boolean(),
});
export type SettingsPlayer = z.infer<typeof SettingsPlayerSchema>;

export const AccountSettingsSchema = z.object({
  hidden: z.boolean(),
  global_ping: z.boolean(),
  group_ping: z.boolean(),
  never_ping: z.boolean(),
  dm_account_changes: z.boolean(),
  /**
   * Supporter submission-DM opt-ins (per type) + minimum drop value in GP.
   * Saved for everyone; only take effect with the `dm_submissions` supporter
   * entitlement (see `supporter_entitlements`).
   */
  dm_drops: z.boolean().default(false),
  dm_pbs: z.boolean().default(false),
  dm_cas: z.boolean().default(false),
  dm_clogs: z.boolean().default(false),
  dm_pets: z.boolean().default(false),
  dm_quests: z.boolean().default(false),
  dm_deaths: z.boolean().default(false),
  dm_diaries: z.boolean().default(false),
  dm_levels: z.boolean().default(false),
  dm_min_value: z.number().int().nonnegative().default(0),
  /** Set by the bot when a DM bounced off the user's Discord privacy
   * settings; PATCH `false` to dismiss (bot re-sets it if it happens again). */
  dm_delivery_issue: z.boolean().default(false),
  /** Resolved user-level entitlements (read-only; drives the DM section gate). */
  supporter_entitlements: UserEntitlementsSchema.optional(),
  players: z.array(SettingsPlayerSchema).default([]),
});
export type AccountSettings = z.infer<typeof AccountSettingsSchema>;
/** PATCH body: any subset of the toggle settings (players are patched per-id). */
export const AccountSettingsPatchSchema = AccountSettingsSchema.omit({
  players: true,
  supporter_entitlements: true,
}).partial();
export type AccountSettingsPatch = z.infer<typeof AccountSettingsPatchSchema>;

/** An NPC or item hit in combined search (name + catalog icon). */
export const SearchEntitySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  icon_url: z.string(),
});
export type SearchEntity = z.infer<typeof SearchEntitySchema>;

/** Combined search results (FRONTEND_PLAN.md §9 "Search"). `npcs`/`items`
 *  default empty so older API deployments without them still parse. */
export const SearchResultsSchema = z.object({
  players: z.array(PlayerSummarySchema),
  groups: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      member_count: z.number().int().optional(),
      /** Group tier flair, present for subscribed groups. */
      flair: GroupFlairSchema.optional(),
    }),
  ),
  npcs: z.array(SearchEntitySchema).default([]),
  items: z.array(SearchEntitySchema).default([]),
});
export type SearchResults = z.infer<typeof SearchResultsSchema>;

// --- Slug resolution (/resolve/{kind}) -------------------------------------
/** One candidate returned by /resolve. Fields beyond id/name are kind-specific
 *  (group: member_count/created_ts/flair/icon_url; player: total_loot;
 *  npc/item: icon_url). */
export const ResolveCandidateSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  icon_url: z.string().optional(),
  member_count: z.number().int().optional(),
  created_ts: z.number().int().optional(),
  total_loot: MoneySchema.optional(),
  flair: GroupFlairSchema.optional(),
});
export type ResolveCandidate = z.infer<typeof ResolveCandidateSchema>;

/** Result of resolving a nice-URL slug: a single `match`, or (group/player
 *  only) `match: null` with a `candidates` list for a disambiguation page. An
 *  empty `candidates` list with a null match means "not found". */
export const ResolveResultSchema = z.object({
  kind: z.enum(["group", "player", "npc", "item"]),
  slug: z.string(),
  match: ResolveCandidateSchema.nullable(),
  candidates: z.array(ResolveCandidateSchema).default([]),
});
export type ResolveResult = z.infer<typeof ResolveResultSchema>;

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
  /** Game id from the item picker — lets the pipeline skip name resolution. */
  item_id: z.number().int().optional(),
  value: z.number().int().nonnegative().optional(),
  quantity: z.number().int().positive().default(1),
  /** Personal best: kill time in milliseconds (required for type "pb"). */
  time_ms: z.number().int().positive().optional(),
  /** Personal best: team size (defaults to solo). */
  team_size: z.number().int().positive().optional(),
  /** Combat achievement: task name + tier (required for type "ca"). */
  task: z.string().max(120).optional(),
  tier: z.enum(["easy", "medium", "hard", "elite", "master", "grandmaster"]).optional(),
  /** Collection log / pet: kill count when the unlock happened. */
  kc: z.number().int().nonnegative().optional(),
  proof_upload_key: z.string().optional(),
  notes: z.string().max(500).optional(),
});
export type ManualSubmission = z.infer<typeof ManualSubmissionSchema>;

/** One manual-submission review row (suggestion #45, Phase 2). */
export const ManualSubmissionRowSchema = z.object({
  drop_id: z.number().int(),
  status: z.enum(["pending", "approved", "rejected", "excluded"]),
  player_id: z.number().int().nullable(),
  player_name: z.string().nullable(),
  item_id: z.number().int().nullable(),
  item_name: z.string().nullable(),
  npc_name: z.string().nullable(),
  quantity: z.number().int(),
  value: MoneySchema,
  image_url: z.string().nullable(),
  submitted_ts: z.number().int().nullable(),
  reviewed_ts: z.number().int().nullable(),
  reason: z.string().nullable(),
});
export type ManualSubmissionRow = z.infer<typeof ManualSubmissionRowSchema>;

export const ManualSubmissionQueueSchema = z.object({
  pending: z.array(ManualSubmissionRowSchema).default([]),
  recent: z.array(ManualSubmissionRowSchema).default([]),
  pending_count: z.number().int().default(0),
});
export type ManualSubmissionQueue = z.infer<typeof ManualSubmissionQueueSchema>;

/** Per-group manual-policy notice for the submit page (suggestion #45, Ph 3). */
export const ManualPolicyNoticeSchema = z.object({
  group_id: z.number().int(),
  group_name: z.string(),
  policy: z.string().nullable(),
  held: z.enum(["excluded", "pending"]),
  message: z.string(),
});
export type ManualPolicyNotice = z.infer<typeof ManualPolicyNoticeSchema>;

export const ManualPreflightSchema = z.object({
  notices: z.array(ManualPolicyNoticeSchema).default([]),
});
export type ManualPreflight = z.infer<typeof ManualPreflightSchema>;

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
  /** Real pings on the Discord post — sent as message content (mentions
   * inside embeds never ping). Snowflake id strings; max 10 each. */
  ping_role_ids: z.array(z.string()).default([]),
  ping_user_ids: z.array(z.string()).default([]),
  ping_everyone: z.boolean().default(false),
});
export type AnnouncementInput = z.infer<typeof AnnouncementInputSchema>;

/** A guild role, for the announcement ping picker (bot-cached via Redis). */
export const DiscordRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number().int().default(0),
});
export type DiscordRole = z.infer<typeof DiscordRoleSchema>;

export const GroupDiscordRolesSchema = z.object({
  roles: z.array(DiscordRoleSchema).default([]),
  /** True while the bot is still warming this guild's role cache — retry shortly. */
  stale: z.boolean().default(false),
});
export type GroupDiscordRoles = z.infer<typeof GroupDiscordRolesSchema>;

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

/**
 * Authorized users — who can administer a group besides its creator
 * (GET/POST/DELETE /api/v1/groups/{id}/authorized-users). Backed by two
 * synced stores: web role grants + the bot's authed_users Discord-ID list.
 */
export const AuthorizedUserSchema = z.object({
  user_id: z.number().int().nullable(),
  discord_id: z.string().nullable(),
  username: z.string().nullable(),
  role: z.enum(["owner", "admin"]),
  /** Where the authorization lives: "web" grant and/or bot "discord" list. */
  sources: z.array(z.enum(["web", "discord"])),
});
export type AuthorizedUser = z.infer<typeof AuthorizedUserSchema>;

export const AuthorizedUsersResponseSchema = z.object({
  users: z.array(AuthorizedUserSchema),
});
export type AuthorizedUsersResponse = z.infer<typeof AuthorizedUsersResponseSchema>;

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
  /** Who this tier applies to: group upgrade vs personal supporter. */
  scope: z.enum(["group", "user"]).default("group"),
  /** Price in minor currency units (e.g. cents) per interval. */
  price_cents: z.number().int().nonnegative(),
  currency: z.string().default("USD"),
  interval: z.enum(["month", "year"]).default("month"),
  /** Human-readable perks for the tier card. */
  features: z.array(z.string()).default([]),
  /** Machine-readable capabilities (runtime access control). */
  entitlements: TierEntitlementsSchema.default({}),
  /** Cosmetic display style granted to subscribed groups (see ./tier-flair). */
  flair: TierFlairSchema,
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

/**
 * One contribution "leg" of a group's subscription pool. Multiple members may
 * each hold their own recurring payment; the group's effective tier is the
 * most expensive tier covered by the sum of live legs (backend
 * `db/entitlements.py effective_group_subscription`).
 */
export const GroupSubscriptionLegSchema = z.object({
  id: z.number().int(),
  /** Payer; null on legacy PayPal agreements and comped/manual grants. */
  user_id: z.number().int().nullable(),
  user_name: z.string().nullable().optional(),
  /** Tier the leg was purchased toward (informational). */
  tier_key: z.string().nullable(),
  /** Recurring charge in minor units; null on legacy rows (tier price applies). */
  amount_cents: z.number().int().nullable(),
  provider: z.enum(["patreon", "stripe", "paypal", "manual", "nitro"]).nullable(),
  status: z.enum(SubscriptionStatus),
  current_period_end: z.number().int().nullable(),
  cancel_at_period_end: z.boolean().default(false),
  /** True when the leg belongs to the requesting user. */
  mine: z.boolean().default(false),
});
export type GroupSubscriptionLeg = z.infer<typeof GroupSubscriptionLegSchema>;

/** Nitro-boost contribution summary attached to a group's subscription: how
 * many of its members boost the DropTracker Discord and the resulting monthly
 * pool credit (see services/nitro_attribution.py). */
export const GroupSubscriptionNitroSchema = z.object({
  booster_count: z.number().int(),
  monthly_cents: z.number().int(),
  per_boost_cents: z.number().int(),
});
export type GroupSubscriptionNitro = z.infer<typeof GroupSubscriptionNitroSchema>;

export const GroupSubscriptionSchema = z.object({
  group_id: z.number().int(),
  /** EFFECTIVE tier key — what the live pool covers; null on the free plan. */
  tier_key: z.string().nullable(),
  status: z.enum(SubscriptionStatus),
  /** Single distinct live-leg provider, or null when mixed/none. */
  provider: z.enum(["patreon", "stripe", "paypal", "manual", "nitro"]).nullable(),
  /** Unix seconds when the soonest live leg ends (pool could shrink). */
  current_period_end: z.number().int().nullable(),
  /** True only when EVERY live leg is winding down. */
  cancel_at_period_end: z.boolean().default(false),
  /** Sum of live legs' monthly-normalized contributions. */
  total_monthly_cents: z.number().int().optional(),
  /** Per-leg breakdown (present on Web API reads). */
  legs: z.array(GroupSubscriptionLegSchema).optional(),
  /** Resolved capabilities for this group's effective tier (present on Web API reads). */
  entitlements: GroupEntitlementsSchema.optional(),
  /** Nitro-boost contribution to the pool; null when no members are boosting. */
  nitro: GroupSubscriptionNitroSchema.nullable().optional(),
});
export type GroupSubscription = z.infer<typeof GroupSubscriptionSchema>;

/** GET/POST /api/v1/me/nitro-boost — which of the signed-in user's groups a
 * Nitro boost they place on the DropTracker Discord supports. */
export const MyNitroBoostSchema = z.object({
  per_boost_cents: z.number().int(),
  /** The group the user explicitly chose, or null (auto-pick applies). */
  designated_group_id: z.number().int().nullable(),
  /** The group the reconciler would credit right now. */
  effective_group_id: z.number().int().nullable(),
  groups: z.array(z.object({ id: z.number().int(), name: z.string() })),
});
export type MyNitroBoost = z.infer<typeof MyNitroBoostSchema>;

/** Public pool summary (GET /groups/{id}/subscription/summary) — feeds the
 * member-facing "Support this clan" card; carries no personal data. */
export const GroupSubscriptionSummarySchema = z.object({
  group_id: z.number().int(),
  tier_key: z.string().nullable(),
  tier_name: z.string().nullable(),
  total_monthly_cents: z.number().int(),
  next_tier: z
    .object({
      key: z.string(),
      name: z.string(),
      price_cents: z.number().int(),
      delta_cents: z.number().int(),
    })
    .nullable()
    .optional(),
});
export type GroupSubscriptionSummary = z.infer<typeof GroupSubscriptionSummarySchema>;

/**
 * User-level supporter subscription (GET /api/v1/users/me/subscription).
 * Same lifecycle as GroupSubscription, scoped to the signed-in user.
 */
export const UserSubscriptionSchema = z.object({
  user_id: z.number().int(),
  tier_key: z.string().nullable(),
  status: z.enum(SubscriptionStatus),
  provider: z.enum(["patreon", "stripe", "paypal", "manual", "nitro"]).nullable(),
  /** Pay-what-you-want: the chosen recurring amount in minor units
   * (the tier's price_cents is the minimum). Null on legacy rows. */
  amount_cents: z.number().int().nullable().optional(),
  current_period_end: z.number().int().nullable(),
  cancel_at_period_end: z.boolean().default(false),
  /** Resolved supporter entitlements (present on Web API reads). */
  entitlements: UserEntitlementsSchema.optional(),
});
export type UserSubscription = z.infer<typeof UserSubscriptionSchema>;

/** Provider-hosted checkout/billing redirect. `url` is null when unavailable. */
export const CheckoutSessionSchema = z.object({ url: z.string().nullable() });
export type CheckoutSession = z.infer<typeof CheckoutSessionSchema>;

/** Editable tier definition for superadmin tier management (FRONTEND_PLAN.md §9). */
export const SubscriptionTierInputSchema = SubscriptionTierSchema;
export type SubscriptionTierInput = z.infer<typeof SubscriptionTierInputSchema>;

/**
 * Custom Discord embed templates (subscription-gated, `custom_embeds`
 * entitlement). Backed by `group_embeds` / `group_embed_fields`; group 1 holds
 * the system defaults every non-subscribed group falls back to.
 */
export const EMBED_TYPES = [
  "drop",
  "clog",
  "pb",
  "ca",
  "pet",
  "level_up",
  "quest",
  "death",
  "diary",
  "lb",
] as const;
export type EmbedType = (typeof EMBED_TYPES)[number];

export const EMBED_TYPE_LABELS: Record<EmbedType, string> = {
  drop: "Drops",
  clog: "Collection log",
  pb: "Personal bests",
  ca: "Combat achievements",
  pet: "Pets",
  level_up: "Level ups",
  quest: "Quests",
  death: "Deaths",
  diary: "Achievement diaries",
  lb: "Lootboard",
};

export const EmbedFieldSchema = z.object({
  name: z.string(),
  value: z.string(),
  inline: z.boolean().default(true),
});
export type EmbedField = z.infer<typeof EmbedFieldSchema>;

export const GroupEmbedSchema = z.object({
  embed_type: z.enum(EMBED_TYPES),
  title: z.string(),
  description: z.string().default(""),
  /** Hex color like `#ffb83f`, or null for Discord's default. */
  color: z.string().nullable().default(null),
  thumbnail: z.string().nullable().default(null),
  image: z.string().nullable().default(null),
  timestamp: z.boolean().default(false),
  fields: z.array(EmbedFieldSchema).default([]),
});
export type GroupEmbed = z.infer<typeof GroupEmbedSchema>;

/** Per-type editor payload: the group's own template + the system default. */
export const GroupEmbedsResponseSchema = z.object({
  embeds: z.array(
    z.object({
      embed_type: z.enum(EMBED_TYPES),
      custom: GroupEmbedSchema.nullable(),
      default: GroupEmbedSchema.nullable(),
    }),
  ),
});
export type GroupEmbedsResponse = z.infer<typeof GroupEmbedsResponseSchema>;

/** PUT body for saving a group's template for one embed type. */
export const GroupEmbedInputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).default(""),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  thumbnail: z.string().max(200).nullable().optional(),
  image: z.string().max(200).nullable().optional(),
  timestamp: z.boolean().default(false),
  fields: z.array(EmbedFieldSchema).max(25).default([]),
});
export type GroupEmbedInput = z.infer<typeof GroupEmbedInputSchema>;

/**
 * Superadmin: backend service control (FRONTEND_PLAN.md §9, §14.1
 * `ServiceManagement`). The three managed units.
 */
export const SERVICE_UNITS = [
  "droptracker-api",
  "droptracker-webapi",
  "droptracker-node",
  "droptracker-node-blue",
  "droptracker-node-green",
  "droptracker-core",
  "droptracker-webhooks",
  "droptracker-heartbeat",
  "droptracker-hof",
  "droptracker-webhook-consumer",
  "droptracker-events",
  "droptracker-lootboards",
  "droptracker-player-updates",
  "droptracker-video-worker",
  "nginx",
  "mariadb",
  "redis-server",
] as const;

export const ServiceStatusSchema = z.object({
  unit: z.string(),
  name: z.string(),
  status: z.enum(["running", "stopped", "failed", "starting", "stopping", "unknown"]),
  active: z.boolean(),
  /** Unix seconds since the current state began. */
  since: z.number().int().nullable(),
  // -- enriched fields (older backends omit them; all defaulted) ----------
  description: z.string().nullish(),
  category: z.string().default("Services"),
  /**
   * service = normal unit (start/stop/restart) · web = traffic-serving Next.js
   * colour (confirm-restart only) · deploy = blue-green deploy trigger
   * (restart = zero-downtime deploy) · infra = read-only system service.
   */
  kind: z.enum(["service", "web", "deploy", "infra"]).default("service"),
  port: z.number().int().nullish(),
  sub_state: z.string().nullish(),
  memory_mb: z.number().nullish(),
  n_restarts: z.number().int().default(0),
  enabled: z.boolean().default(true),
  /** systemd Result — for the deploy oneshot this is the last deploy outcome. */
  last_result: z.string().nullish(),
  /** Control actions the backend permits for this unit. */
  actions: z.array(z.enum(["start", "stop", "restart"])).default(["start", "stop", "restart"]),
  confirm_stop: z.boolean().default(false),
  confirm_restart: z.boolean().default(false),
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

/**
 * Superadmin: nightly database backup visibility (/admin/backups).
 * Mirrors the backend's droptracker-db-backup unit + local set scan.
 */
export const BackupFileSchema = z.object({
  name: z.string(),
  size: z.number().int(),
  /** Unix seconds. */
  modified: z.number().int(),
});
export type BackupFile = z.infer<typeof BackupFileSchema>;

export const BackupSetSchema = z.object({
  /** UTC date of the set, YYYY-MM-DD. */
  date: z.string(),
  status: z.enum(["complete", "in_progress", "incomplete"]),
  total_bytes: z.number().int(),
  files: z.array(BackupFileSchema),
});
export type BackupSet = z.infer<typeof BackupSetSchema>;

export const BackupOverviewSchema = z.object({
  unit: z.string(),
  running: z.boolean(),
  timer: z.object({
    enabled: z.boolean(),
    active: z.boolean(),
    next_run: z.number().int().nullable(),
    last_trigger: z.number().int().nullable(),
  }),
  last_run: z
    .object({
      started: z.number().int(),
      finished: z.number().int().nullable(),
      duration_seconds: z.number().int().nullable(),
      success: z.boolean(),
      result: z.string(),
      exit_status: z.number().int().nullable(),
    })
    .nullable(),
  sets: z.array(BackupSetSchema),
  disk: z.object({
    free_bytes: z.number().int(),
    total_bytes: z.number().int(),
  }),
  retention: z.object({
    local_days: z.number().int(),
    remote_days: z.number().int(),
  }),
});
export type BackupOverview = z.infer<typeof BackupOverviewSchema>;

export const BackupOffsiteSchema = z.object({
  bucket: z.string(),
  prefix: z.string(),
  total_bytes: z.number().int(),
  days: z.array(
    z.object({
      date: z.string(),
      objects: z.number().int(),
      total_bytes: z.number().int(),
      files: z.array(BackupFileSchema),
    }),
  ),
});
export type BackupOffsite = z.infer<typeof BackupOffsiteSchema>;

/**
 * Superadmin: bucket-wide B2 storage usage + cost estimate (/admin/b2/usage).
 * Bandwidth/egress is NOT included — B2's public API does not expose it.
 */
export const B2UsageSchema = z.object({
  bucket: z.string(),
  generated_at: z.number().int(),
  objects: z.number().int(),
  total_bytes: z.number().int(),
  prefixes: z.array(
    z.object({
      prefix: z.string(),
      objects: z.number().int(),
      total_bytes: z.number().int(),
    }),
  ),
  largest: z.array(
    z.object({
      key: z.string(),
      size: z.number().int(),
      modified: z.number().int(),
    }),
  ),
  estimate: z.object({
    storage_rate_usd_per_gb_month: z.number(),
    free_storage_bytes: z.number().int(),
    storage_usd_per_month: z.number(),
    free_egress_bytes_per_month: z.number().int(),
  }),
});
export type B2Usage = z.infer<typeof B2UsageSchema>;

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
 * Superadmin personal-best NPC blocklist. Some NPCs have no real personal best
 * (the game exposes none, so our tracking is bugged and stores junk). Blocking
 * an NPC drops future PB submissions for it and permanently purges its existing
 * rows. A "boss" bundles the variant npc_ids that share a name (e.g. Giant Mole
 * -> two ids), which are always blocked/unblocked together.
 */
export const PbBlockBossSchema = z.object({
  name: z.string(),
  npc_ids: z.array(z.number().int()),
  /** Existing personal_best rows for this boss (0 once purged). */
  pb_count: z.number().int(),
});
export type PbBlockBoss = z.infer<typeof PbBlockBossSchema>;

/** GET /admin/pb-blocks */
export const PbBlockListSchema = z.object({
  bosses: z.array(PbBlockBossSchema),
  blocked_ids: z.array(z.number().int()),
});
export type PbBlockList = z.infer<typeof PbBlockListSchema>;

/** One search hit (GET /admin/pb-blocks/search) — a boss, plus whether it is
 * already fully blocked. */
export const PbBlockSearchResultSchema = PbBlockBossSchema.extend({
  blocked: z.boolean(),
});
export type PbBlockSearchResult = z.infer<typeof PbBlockSearchResultSchema>;

export const PbBlockSearchResponseSchema = z.object({
  results: z.array(PbBlockSearchResultSchema),
});
export type PbBlockSearchResponse = z.infer<typeof PbBlockSearchResponseSchema>;

/** Result of adding/removing a block (POST/DELETE /admin/pb-blocks). */
export const PbBlockMutationSchema = z.object({
  ok: z.boolean(),
  blocked_ids: z.array(z.number().int()),
  bosses: z.array(PbBlockBossSchema).default([]),
  added_ids: z.array(z.number().int()).optional(),
  removed_ids: z.array(z.number().int()).optional(),
  /** personal_best rows deleted by a block add. */
  deleted_pb: z.number().int().optional(),
});
export type PbBlockMutation = z.infer<typeof PbBlockMutationSchema>;

/**
 * Superadmin site overview KPIs (dashboard landing). Flexible tiles: each stat
 * has a machine `key`, human `label`, numeric `value`, and optional `hint`.
 */
export const AdminOverviewStatSchema = z.object({
  key: z.string(),
  label: z.string(),
  /** Counts are numbers; preformatted stats (e.g. MRR "$123.45") are strings. */
  value: z.union([z.number(), z.string()]),
  hint: z.string().optional(),
});
export type AdminOverviewStat = z.infer<typeof AdminOverviewStatSchema>;

export const AdminOverviewSchema = z.object({
  stats: z.array(AdminOverviewStatSchema),
  generated_at: z.number().int(),
});
export type AdminOverview = z.infer<typeof AdminOverviewSchema>;

/** Monetization dashboard payload (GET /admin/subscriptions/overview). */
export const AdminSubscriptionRowSchema = z.object({
  scope: z.enum(["group", "user"]),
  id: z.number().int(),
  group_id: z.number().int().nullable(),
  group_name: z.string().nullable(),
  user_id: z.number().int().nullable(),
  user_name: z.string().nullable(),
  tier_key: z.string().nullable(),
  amount_cents: z.number().int().nullable(),
  provider: z.string().nullable(),
  status: z.enum(SubscriptionStatus),
  /** Currently conferring benefits (status + period-end grace). */
  live: z.boolean(),
  current_period_end: z.number().int().nullable(),
  cancel_at_period_end: z.boolean(),
});
export type AdminSubscriptionRow = z.infer<typeof AdminSubscriptionRowSchema>;

export const AdminPaymentRowSchema = z.object({
  id: z.number().int(),
  scope: z.enum(["group", "user"]),
  group_id: z.number().int().nullable(),
  group_name: z.string().nullable(),
  user_id: z.number().int().nullable(),
  user_name: z.string().nullable(),
  tier_key: z.string().nullable(),
  provider: z.string(),
  amount_cents: z.number().int(),
  currency: z.string(),
  kind: z.enum(["payment", "refund", "reversal"]),
  paid_at: z.number().int().nullable(),
});
export type AdminPaymentRow = z.infer<typeof AdminPaymentRowSchema>;

export const AdminSubscriptionsOverviewSchema = z.object({
  kpis: z.object({
    mrr_cents: z.number().int(),
    group_mrr_cents: z.number().int(),
    user_mrr_cents: z.number().int(),
    paying_groups: z.number().int(),
    active_user_subscriptions: z.number().int(),
    past_due: z.number().int(),
    lifetime_cents: z.number().int(),
  }),
  tier_distribution: z.array(
    z.object({
      tier_key: z.string(),
      tier_name: z.string(),
      groups: z.number().int(),
    }),
  ),
  /** Last 12 months of ledger income (payments − refunds), oldest first. */
  income_by_month: z.array(z.object({ month: z.string(), amount_cents: z.number().int() })),
  subscriptions: z.array(AdminSubscriptionRowSchema),
  recent_payments: z.array(AdminPaymentRowSchema),
  generated_at: z.number().int(),
});
export type AdminSubscriptionsOverview = z.infer<typeof AdminSubscriptionsOverviewSchema>;

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
  fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
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
/** One player's share of a lootboard item stack (tooltip breakdown). */
export const LootItemContributorSchema = z.object({
  player_id: z.number().int(),
  player_name: z.string(),
  quantity: z.number().int(),
  /** Value contributed by this player (their qty × unit value). */
  value: MoneySchema,
  /** When this player last received the item ("YYYY-MM-DD HH:MM:SS"). */
  last_at: z.string().nullable().optional(),
});
export type LootItemContributor = z.infer<typeof LootItemContributorSchema>;

export const LootItemSchema = z.object({
  item_id: z.number().int(),
  name: z.string(),
  quantity: z.number().int(),
  /** Total value for this row (unit value × quantity). */
  value: MoneySchema,
  icon_url: z.string().optional(),
  /** True for the coin pile (item 995) — value only, no quantity label. */
  is_coin: z.boolean().optional(),
  /** Top recipients by contributed value (tooltip per-player breakdown). */
  contributors: z.array(LootItemContributorSchema).optional(),
  /** Total distinct recipients (contributors is capped server-side). */
  contributor_count: z.number().int().optional(),
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
  "loot_value",
  /** Manual-confirmation-only tasks (no automated evaluation). */
  "custom",
] as const;

/** How a task's reusable library copy is shared: public rows appear in every
 * group's picker, private rows only in the owning group's. */
export const EVENT_TASK_VISIBILITIES = ["public", "private"] as const;

/** How players get onto teams (events-prd.md D4). All but `admin_assign` let
 * players self-sign-up from the event page / a Discord button. `signup_pool`
 * collects opt-ins with no team; admins sort/randomize them later. */
export const EVENT_FORMATION_MODES = [
  "self_join",
  "auto_assign",
  "signup_pool",
  "admin_assign",
] as const;

/** Formation modes that let a player sign themselves up. */
export const EVENT_SELF_SIGNUP_MODES = ["self_join", "auto_assign", "signup_pool"] as const;

/** Event ownership shape: one group (or global), or host-vs-invited-clans. */
export const EVENT_MODES = ["standard", "clan_vs_clan"] as const;

/** Task/tile difficulty tiers (legacy elements; air easiest → fire hardest).
 * Board-game tiles roll their tasks from per-tier pools (web44a). */
export const EVENT_TASK_DIFFICULTIES = ["air", "water", "earth", "fire"] as const;
export type EventTaskDifficulty = (typeof EVENT_TASK_DIFFICULTIES)[number];

/** Event game format (web43a) — orthogonal to `mode` (ownership). Which
 * kinds a non-superadmin may CREATE is governed site-wide by the
 * web_event_types registry (enabled/admin_only + test-group allowlist);
 * existing events of a disabled kind keep running. */
export const EVENT_KINDS = ["standard", "bingo", "board_game"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** One row of GET /events/meta/types — the create form's kind picker.
 * Every registry row is returned; `creatable` is resolved for the current
 * viewer + group. */
export const EventKindMetaSchema = z.object({
  key: z.enum(EVENT_KINDS),
  label: z.string(),
  description: z.string().nullable().optional(),
  enabled: z.boolean(),
  admin_only: z.boolean(),
  creatable: z.boolean(),
});
export type EventKindMeta = z.infer<typeof EventKindMetaSchema>;

/** Admin registry row (GET/PATCH /admin/event-types) with the per-kind
 * test-group allowlist. */
export const AdminEventTypeSchema = z.object({
  key: z.enum(EVENT_KINDS),
  label: z.string(),
  description: z.string().nullable().optional(),
  enabled: z.boolean(),
  admin_only: z.boolean(),
  sort: z.number().int().default(0),
  test_groups: z
    .array(z.object({ group_id: z.number().int(), group_name: z.string() }))
    .default([]),
});
export type AdminEventType = z.infer<typeof AdminEventTypeSchema>;

/** Clan-vs-clan participant roster (web_event_groups). */
export const EVENT_PARTICIPANT_ROLES = ["host", "opponent"] as const;
export const EVENT_PARTICIPANT_STATUSES = ["invited", "accepted", "declined"] as const;

/** Which submissions the event engine accepts: everything, non-plugin ones
 * queued for admin confirmation, or plugin-API ones only. */
export const EVENT_SUBMISSION_POLICIES = ["all", "confirm_non_api", "api_only"] as const;

/** Event-level audience (web_events.visibility): "public" — anyone can see it
 * (default); "private" — only participating-group members + event admins ever
 * see it, at any lifecycle status. Distinct from EVENT_TASK_VISIBILITIES,
 * which only governs task-library reuse. */
export const EVENT_VISIBILITIES = ["public", "private"] as const;

/** Prize-pot ledger (web52a): a buy-in (a stake to enter, with a paid tick) vs.
 * a donation (extra/standalone GP, possibly from a non-participant). */
export const EVENT_BUYIN_KINDS = ["buyin", "donation"] as const;
export type EventBuyinKind = (typeof EVENT_BUYIN_KINDS)[number];
/** Only "paid" rows count toward the pot; the tick flips pledged→paid;
 * donations default paid; "void" = soft-removed (kept for audit). */
export const EVENT_BUYIN_STATUSES = ["pledged", "paid", "void"] as const;
export type EventBuyinStatus = (typeof EVENT_BUYIN_STATUSES)[number];
/** Who is *advertised* as taking the pot (advisory display, not a transfer):
 * first place only, the top N teams, or a custom percentage split by place. */
export const EVENT_PRIZE_DISTRIBUTIONS = ["first_only", "top_n", "custom_split"] as const;
export type EventPrizeDistribution = (typeof EVENT_PRIZE_DISTRIBUTIONS)[number];

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
export const EVENT_CHANNEL_KINDS = [
  "announcements",
  "completions",
  "leaderboard",
  "admin",
] as const;

/** When the mirrored Discord scheduled event goes live: on activation
 * (default — drafts create nothing on Discord) or immediately at creation. */
export const EVENT_DISCORD_POLICIES = ["on_activate", "immediate"] as const;
export type EventDiscordPolicy = (typeof EVENT_DISCORD_POLICIES)[number];

/** Role-ping slots (web_events.ping_config): the companion message posted
 * when the Discord scheduled event is created, plus the start/end
 * announcements. */
export const EVENT_PING_KEYS = ["event_created", "event_started", "event_ended"] as const;
export type EventPingKey = (typeof EVENT_PING_KEYS)[number];

/** Per-event message-verbosity toggles (web_events.message_config). Each key
 * is one Discord notification type a group leader can silence for the event;
 * the backend rejects unknown keys on PUT. */
export const EVENT_MESSAGE_TOGGLE_KEYS = [
  "event_started",
  "event_ended",
  "event_completion",
  "event_task_progress",
  "event_line",
  "event_blackout",
  "event_lead_change",
  "event_pending",
  "event_activation_failed",
  "event_board_turn",
  /** Board game: "task done — roll the dice" nudge (default OFF for the
   * event's main channels; per-team channels carry it by default). */
  "event_board_roll_prompt",
] as const;
export type EventMessageToggleKey = (typeof EVENT_MESSAGE_TOGGLE_KEYS)[number];

/** How chatty task-progress updates are: silent, 25/50/75% milestones, or
 * every qualifying update (gated by the event_task_progress toggle). */
export const EVENT_TASK_PROGRESS_MODES = ["off", "milestones", "all"] as const;
export type EventTaskProgressMode = (typeof EVENT_TASK_PROGRESS_MODES)[number];

/** Square bingo boards only; 5×5 is the default. */
export const EVENT_BOARD_SIZES = [3, 4, 5, 6, 7] as const;

/** One icon of a task tile. `id` maps to `/img/{itemdb|npcdb}/{id}.png`;
 * skill icons are keyed by name (`/img/metrics/{name}.png`) with `id: null`. */
export const TaskTileIconSchema = z.object({
  type: z.enum(["item", "npc", "skill"]),
  id: z.number().int().nullable().optional(),
  name: z.string(),
  /** Required count shown as a chip on the icon (present when > 1). */
  quantity: z.number().int().optional(),
});
export type TaskTileIcon = z.infer<typeof TaskTileIconSchema>;

/** Display metadata for a task's board tile: resolved icon refs plus a
 * legacy-style badge ("KC TARGET", "FULL SET", …) and short value string
 * ("100.00M GP"). The frontend composes tile art from these. */
export const TaskTileSchema = z.object({
  badge: z.string().nullable().optional(),
  value: z.string().nullable().optional(),
  icons: z.array(TaskTileIconSchema),
  /** Icons dropped past the server-side cap; render as a "+N" chip. */
  icon_overflow: z.number().int().default(0),
});
export type TaskTile = z.infer<typeof TaskTileSchema>;

export const EventTaskSchema = z.object({
  id: z.number().int(),
  type: z.enum(EVENT_TASK_TYPES),
  label: z.string(),
  /** e.g. boss/skill/item name the task is scoped to. */
  target: z.string().nullable().optional(),
  /** Numeric goal (kc, xp, level, seconds…), interpreted per `type`. */
  target_value: z.number().int().nullable().optional(),
  points: z.number().int().default(0),
  /** Completions of this task queue for admin review instead of auto-applying. */
  requires_confirmation: z.boolean().default(false),
  /** Library-copy publicity: public (any clan can reuse) or private (this clan only). */
  visibility: z.enum(EVENT_TASK_VISIBILITIES).default("public"),
  /** Board-game tier (web44a); null on tasks that never set one. */
  difficulty: z.enum(EVENT_TASK_DIFFICULTIES).nullable().optional(),
  /** JSON string: any_of/assembly/point_collection item lists etc. */
  config: z.string().nullable().optional(),
  /** Board-tile display metadata (absent on payloads from before the
   * tile-resurrection pass). */
  tile: TaskTileSchema.nullable().optional(),
});
export type EventTask = z.infer<typeof EventTaskSchema>;

/** Roster entry. `joined_at` (unix) is the credit cutoff (events-prd.md D10). */
/** Leadership roles a roster row may carry (web48a); null = plain member. */
export const EVENT_TEAM_ROLES = ["leader", "co_leader"] as const;
export type EventTeamRole = (typeof EVENT_TEAM_ROLES)[number];

export const EventMemberSchema = z.object({
  player_id: z.number().int(),
  player_name: z.string(),
  joined_at: z.number().int().nullable(),
  /** "leader" / "co_leader" when the event runs team leadership (web48a). */
  role: z.enum(EVENT_TEAM_ROLES).nullable().optional(),
});
export type EventMember = z.infer<typeof EventMemberSchema>;

export const EventTeamSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  score: z.number().int().default(0),
  member_count: z.number().int().default(0),
  /** The clan this team represents (clan_vs_clan only; null on standard). */
  group_id: z.number().int().nullable().optional(),
  /** Admin-assigned accent color ("#rrggbb"); null = index-based palette. */
  color: z.string().nullable().optional(),
  /** Board game (web44a): coin wallet + OSRS-item game piece. */
  coins: z.number().int().default(0),
  piece_item_id: z.number().int().nullable().optional(),
  /** Present on EventDetail reads (Task 16); absent on legacy payloads. */
  members: z.array(EventMemberSchema).optional(),
  /** Prize pot (web52a): this team's paid buy-ins + donations. Present on
   * EventDetail reads once the pot feature ships; absent on legacy payloads. */
  pot_total: MoneySchema.optional(),
});
export type EventTeam = z.infer<typeof EventTeamSchema>;

/** A single buy-in / donation row (web52a). `rsn` is the live player name or a
 * free-text external-donor label; `note`/pledged rows are admin-only. */
export const EventBuyinSchema = z.object({
  id: z.number().int(),
  player_id: z.number().int().nullable().optional(),
  rsn: z.string().nullable().optional(),
  team_id: z.number().int().nullable().optional(),
  kind: z.enum(EVENT_BUYIN_KINDS),
  amount: MoneySchema,
  status: z.enum(EVENT_BUYIN_STATUSES),
  note: z.string().nullable().optional(),
  created_at: z.number().int().nullable().optional(),
});
export type EventBuyin = z.infer<typeof EventBuyinSchema>;

/** Prize-pot configuration (web_events.prize_config) as returned by the pot
 * read — every GP figure is a Money envelope. */
export const EventPrizeConfigSchema = z.object({
  default_buyin: MoneySchema,
  distribution: z.enum(EVENT_PRIZE_DISTRIBUTIONS).default("first_only"),
  top_n: z.number().int().default(1),
  splits: z.array(z.number().int()).default([100]),
  advertise: z.boolean().default(false),
  show_contributors: z.boolean().default(true),
  allow_leader_mark: z.boolean().default(false),
});
export type EventPrizeConfig = z.infer<typeof EventPrizeConfigSchema>;

/** Full prize-pot read (GET /events/{id}/pot). `contributors` is null when the
 * viewer may not see the list (show_contributors off and not an admin). */
export const EventPrizePotSchema = z.object({
  enabled: z.boolean().default(false),
  total: MoneySchema,
  buyin_total: MoneySchema,
  donation_total: MoneySchema,
  config: EventPrizeConfigSchema,
  per_team: z
    .array(
      z.object({
        team_id: z.number().int(),
        name: z.string(),
        total: MoneySchema,
        paid_count: z.number().int().default(0),
        member_count: z.number().int().default(0),
      }),
    )
    .default([]),
  contributors: z.array(EventBuyinSchema).nullable().optional(),
  can_manage: z.boolean().default(false),
});
export type EventPrizePot = z.infer<typeof EventPrizePotSchema>;

/** Lightweight pot block folded into EventDetail (rides the event SSE refresh)
 * so the standings banner shows a live headline without a second fetch. */
export const EventPrizePotSummarySchema = z.object({
  enabled: z.boolean().default(false),
  total: MoneySchema,
  advertise: z.boolean().default(false),
  distribution: z.enum(EVENT_PRIZE_DISTRIBUTIONS).default("first_only"),
  top_n: z.number().int().default(1),
});
export type EventPrizePotSummary = z.infer<typeof EventPrizePotSummarySchema>;

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
  /** Pending-review overlay (web53a): teams whose pending submissions would
   * FINISH this cell ("done, awaiting review" — amber tile), and teams with
   * some parts pending but the tile not yet fully covered. */
  pending_teams: z.array(z.number().int()).optional(),
  pending_partial_teams: z.array(z.number().int()).optional(),
});
export type BingoCell = z.infer<typeof BingoCellSchema>;

export const BingoBoardSchema = z.object({
  /** Board is `size` × `size`. */
  size: z.number().int(),
  cells: z.array(BingoCellSchema),
});
export type BingoBoard = z.infer<typeof BingoBoardSchema>;

// --------------------------------------------------------------------------
// Board game (web44a)
// --------------------------------------------------------------------------
export const EVENT_BOARD_TILE_KINDS = ["start", "normal", "special", "finish"] as const;
export const BOARD_TILE_RENDER_MODES = ["rune", "invisible", "outline"] as const;

/** The §2.5 board settings document — the backend always returns it fully
 * defaulted, so every key is present on reads. */
export const BoardSettingsSchema = z.object({
  movement: z.object({
    mode: z.enum(["dice", "fixed_step"]),
    dice_count: z.number().int(),
    dice_sides: z.number().int(),
    fixed_step: z.number().int(),
    trigger: z.enum(["auto", "manual"]),
    manual_roller: z.enum(["team", "group_admin", "either"]),
  }),
  tile_render: z.object({
    mode: z.enum(BOARD_TILE_RENDER_MODES),
    outline_width: z.number().int(),
    outline_color: z.string(),
    show_labels: z.boolean(),
    /** Rune-icon px size (rune render mode only). Backend returns this
     * fully-defaulted; older payloads without it fall back to 20. */
    icon_size: z.number().int().min(8).max(64).default(20),
  }),
  coins: z.object({
    enabled: z.boolean(),
    per_difficulty: z.record(z.string(), z.number().int()),
    default: z.number().int(),
    starting: z.number().int(),
  }),
  shop: z
    .object({
      enabled: z.boolean(),
      /** Shop restock cadence (web50a): "none" never refreshes; "turns"/"hours"
       * restock every `refresh_interval` turns/hours. Defaulted for back-compat. */
      refresh_mode: z.enum(["none", "turns", "hours"]).default("none"),
      refresh_interval: z.number().default(0),
    })
    .passthrough(),
  /** Item/power-up config (web45a+). Kept permissive so older/newer backend
   * payloads still parse; the backend always returns fully-defaulted values.
   * `behaviors.roadblock` (Dinh's Bulwark tuning) lives under `behaviors`. */
  items: z
    .object({
      enabled_item_ids: z.array(z.number().int()).nullable().optional(),
      disabled_effects: z.array(z.string()).optional(),
      behaviors: z.record(z.string(), z.any()).optional(),
    })
    .partial()
    .passthrough()
    .optional(),
  mercy: z.object({
    enabled: z.boolean(),
    base_hours: z.number(),
    step_hours: z.number(),
  }),
  win: z.object({ rule: z.string() }).passthrough(),
});
export type BoardSettings = z.infer<typeof BoardSettingsSchema>;

export const BoardTileSchema = z.object({
  idx: z.number().int(),
  /** Fractional 0..1 position on the background image. */
  x: z.number(),
  y: z.number(),
  label: z.string().nullable().optional(),
  /** Difficulty-roll tile: draws a random pool task of this tier per landing. */
  difficulty: z.enum(EVENT_TASK_DIFFICULTIES).nullable().optional(),
  /** Pinned tile: one specific event task. */
  task_id: z.number().int().nullable().optional(),
  task_label: z.string().nullable().optional(),
  tile_kind: z.enum(EVENT_BOARD_TILE_KINDS).default("normal"),
});
export type BoardTile = z.infer<typeof BoardTileSchema>;

export const BoardPositionSchema = z.object({
  team_id: z.number().int(),
  team_name: z.string(),
  color: z.string().nullable().optional(),
  piece_item_id: z.number().int().nullable().optional(),
  piece_icon_url: z.string().nullable().optional(),
  coins: z.number().int().default(0),
  score: z.number().int().default(0),
  tile_idx: z.number().int(),
  status: z.enum(["active", "awaiting_roll", "blocked", "finished"]),
  turns_completed: z.number().int().default(0),
  current_task: z
    .object({
      id: z.number().int(),
      label: z.string(),
      type: z.string(),
      difficulty: z.string().nullable().optional(),
      progress: z.number().int(),
      target: z.number().int(),
    })
    .nullable()
    .optional(),
  last_roll: z
    .object({
      dice: z.array(z.number().int()),
      from: z.number().int(),
      to: z.number().int(),
      at: z.number().int(),
    })
    .nullable()
    .optional(),
  mercy_deadline: z.number().int().nullable().optional(),
  /** Pending task choice (web50a — choose_task items like Cache of Runes):
   * the backend rolled N candidate tasks and parked them on the position; the
   * team picks one via POST /events/{id}/board/choice before it can proceed. */
  pending_choice: z
    .array(
      z.object({
        index: z.number().int(),
        label: z.string(),
        task_id: z.number().int().nullable().optional(),
        difficulty: z.string().nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
});
export type BoardPosition = z.infer<typeof BoardPositionSchema>;

/** A live tile-bound effect (web49a) — e.g. a placed Dinh's Bulwark roadblock.
 * Surfaced to every viewer so the board shows current obstacles. */
export const BoardEffectSchema = z.object({
  id: z.number().int(),
  effect_type: z.string(),
  target_tile_idx: z.number().int(),
  placed_by_team_id: z.number().int().nullable().optional(),
  /** OSRS item id for the marker icon (resolved from the shop catalog). */
  icon_item_id: z.number().int().nullable().optional(),
  name: z.string().nullable().optional(),
  visible_to_all: z.boolean().optional().default(true),
});
export type BoardEffect = z.infer<typeof BoardEffectSchema>;

export const BoardDetailSchema = z.object({
  event_id: z.number().int(),
  background_url: z.string().nullable().optional(),
  bg_width: z.number().int().nullable().optional(),
  bg_height: z.number().int().nullable().optional(),
  settings: BoardSettingsSchema,
  tiles: z.array(BoardTileSchema),
  finish_idx: z.number().int().nullable().optional(),
  positions: z.array(BoardPositionSchema),
  effects: z.array(BoardEffectSchema).optional().default([]),
});
export type BoardDetail = z.infer<typeof BoardDetailSchema>;

/** PUT /events/{id}/board — the designer's autosave payload. Exactly one of
 * difficulty / task_id / library_item_id per tile (or none = rest tile). */
export const BoardTileInputSchema = z.object({
  idx: z.number().int().nonnegative(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  label: z.string().max(255).optional(),
  difficulty: z.enum(EVENT_TASK_DIFFICULTIES).nullable().optional(),
  task_id: z.number().int().nullable().optional(),
  library_item_id: z.number().int().nullable().optional(),
  tile_kind: z.enum(EVENT_BOARD_TILE_KINDS).optional(),
});
export const BoardInputSchema = z.object({
  background_url: z.string().max(255).nullable().optional(),
  bg_width: z.number().int().nullable().optional(),
  bg_height: z.number().int().nullable().optional(),
  tiles: z.array(BoardTileInputSchema).max(512),
});
export type BoardInput = z.infer<typeof BoardInputSchema>;

/** One purchasable power-up as offered by an event's shop (web45a). */
export const BoardShopItemSchema = z.object({
  id: z.number().int(),
  key: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  icon_item_id: z.number().int().nullable().optional(),
  item_type: z.enum(["movement", "offensive", "defensive", "economy", "utility"]),
  effect: z.string(),
  cost_coins: z.number().int(),
  type_cooldown_turns: z.number().int(),
  stock: z.number().int().nullable().optional(),
  usable_now: z.boolean().default(true),
  /** Per-event purchase limits (web50a). All backward-compatible defaults so
   * older shop payloads still parse. */
  per_team_cap: z.number().int().nullable().optional(),
  // null when the shop is fetched without a team context (no purchases to count).
  bought_by_team: z.number().int().nullable().default(0),
  stock_per_refresh: z.number().int().nullable().optional(),
  enabled: z.boolean().optional(),
});
export type BoardShopItem = z.infer<typeof BoardShopItemSchema>;

export const BoardInventoryItemSchema = z.object({
  inventory_id: z.number().int(),
  shop_item_id: z.number().int(),
  key: z.string(),
  name: z.string(),
  icon_item_id: z.number().int().nullable().optional(),
  item_type: z.string(),
  effect: z.string(),
  status: z.enum(["owned", "used", "expired"]),
  acquired_turn: z.number().int(),
  used_turn: z.number().int().nullable().optional(),
  cooldown_ready: z.boolean(),
  cooldown_ready_turn: z.number().int().nullable().optional(),
  usable_now: z.boolean().default(true),
});
export type BoardInventoryItem = z.infer<typeof BoardInventoryItemSchema>;

export const BoardShopStateSchema = z.object({
  items: z.array(BoardShopItemSchema),
  team: z
    .object({
      team_id: z.number().int(),
      coins: z.number().int(),
      turns_completed: z.number().int(),
      inventory: z.array(BoardInventoryItemSchema),
    })
    .nullable()
    .optional(),
});
export type BoardShopState = z.infer<typeof BoardShopStateSchema>;

/** Superadmin catalog row (/admin/boardgame-shop). */
export const AdminShopItemSchema = BoardShopItemSchema.extend({
  effect_config: z.string().nullable().optional(),
  sort: z.number().int().default(0),
  active: z.boolean(),
}).omit({ stock: true, usable_now: true });
export type AdminShopItem = z.infer<typeof AdminShopItemSchema>;

/** One row of the per-event shop-config editor (web50a): the catalog item's
 * display fields plus this event's overrides. Blank/null override = fall back
 * to the catalog default (price), unlimited (stock) or uncapped (per-team). */
export const BoardShopConfigItemSchema = z.object({
  shop_item_id: z.number().int(),
  key: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  icon_item_id: z.number().int().nullable().optional(),
  item_type: z.string(),
  effect: z.string(),
  /** Catalog default price — shown as the price input's placeholder. */
  default_cost_coins: z.number().int(),
  enabled: z.boolean().default(true),
  price_override: z.number().int().nullable().optional(),
  stock_per_refresh: z.number().int().nullable().optional(),
  per_team_cap: z.number().int().nullable().optional(),
});
export type BoardShopConfigItem = z.infer<typeof BoardShopConfigItemSchema>;

/** GET /events/{id}/board/shop/config — the refresh cadence (mirrored from
 * settings.shop) plus a row per active catalog item. */
export const BoardShopConfigSchema = z.object({
  refresh_mode: z.enum(["none", "turns", "hours"]).default("none"),
  refresh_interval: z.number().int().default(0),
  items: z.array(BoardShopConfigItemSchema),
});
export type BoardShopConfig = z.infer<typeof BoardShopConfigSchema>;

/** PUT /events/{id}/board/shop/config body — per-item overrides only. */
export const BoardShopConfigInputSchema = z.object({
  items: z.array(
    z.object({
      shop_item_id: z.number().int(),
      enabled: z.boolean().optional(),
      price_override: z.number().int().nullable().optional(),
      stock_per_refresh: z.number().int().nullable().optional(),
      per_team_cap: z.number().int().nullable().optional(),
    }),
  ),
});
export type BoardShopConfigInput = z.infer<typeof BoardShopConfigInputSchema>;

export const BoardRollResultSchema = z.object({
  dice: z.array(z.number().int()),
  from: z.number().int(),
  to: z.number().int(),
  turn: z.number().int(),
  won: z.boolean(),
  /** An active freeze zeroed this roll's movement (P3). */
  frozen: z.boolean().optional(),
  /** Movement stopped short on a rival's trap (P3). */
  roadblock: z
    .object({ tile_idx: z.number().int(), placed_by_team_id: z.number().int() })
    .optional(),
  task_id: z.number().int().optional(),
  task_label: z.string().optional(),
  task_difficulty: z.string().nullable().optional(),
});
export type BoardRollResult = z.infer<typeof BoardRollResultSchema>;

export const EVENT_STATUS = ["draft", "active", "past"] as const;

export const EventSummarySchema = z.object({
  id: z.number().int(),
  group_id: z.number().int().nullable(),
  name: z.string(),
  // Backend serializes an empty description as null (not omitted), so accept
  // both null and undefined here — a plain .optional() rejects null and made
  // the whole list parse throw once any event lacked a description.
  description: z.string().nullable().optional(),
  status: z.enum(EVENT_STATUS),
  /** "private" hides the event from the public site/lists — only
   * participating-group members + event admins see it. Defaulted for payloads
   * predating the visibility column. */
  visibility: z.enum(EVENT_VISIBILITIES).default("public"),
  starts_at: z.number().int().nullable(),
  ends_at: z.number().int().nullable(),
  has_bingo: z.boolean().default(false),
  /** clan_vs_clan events keep `group_id` = the HOST clan; opponents live in
   * the participants roster (GET /events/{id}/participants). */
  mode: z.enum(EVENT_MODES).default("standard"),
  /** Game format (web43a): standard | bingo | board_game. Defaulted for
   * payloads predating the kind column. */
  kind: z.enum(EVENT_KINDS).default("standard"),
  formation_mode: z.enum(EVENT_FORMATION_MODES).default("admin_assign"),
  /** Event-level force: all completions queue for admin review. */
  requires_confirmation: z.boolean().default(false),
  submission_policy: z.enum(EVENT_SUBMISSION_POLICIES).default("all"),
  board_size: z.number().int().default(5),
  bonus_line_points: z.number().int().default(0),
  bonus_blackout_points: z.number().int().default(0),
  /** Team-leadership knobs (web48a); defaulted for pre-web48a payloads. */
  leadership: z
    .object({
      enabled: z.boolean().default(false),
      co_leaders: z.boolean().default(false),
      selection: z.enum(["admin", "election"]).default("admin"),
    })
    .default({ enabled: false, co_leaders: false, selection: "admin" }),
  /** clan_vs_clan: each accepted clan runs its own Discord config (web48a). */
  per_group_discord: z.boolean().default(false),
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
  /** Viewer's players in the sign-up pool but not yet placed (signup_pool). */
  signed_up_player_ids: z.array(z.number().int()).default([]),
  /** Leadership role any of the viewer's players holds on their team
   * (web48a) — gates board roll/shop buttons client-side. */
  team_role: z.enum(EVENT_TEAM_ROLES).nullable().optional(),
});
export type EventViewer = z.infer<typeof EventViewerSchema>;

/** Per-(task, team) rollup driven by the completion engine. */
export const EventProgressSchema = z.object({
  task_id: z.number().int(),
  team_id: z.number().int(),
  progress: z.number().int().default(0),
  completed: z.boolean().default(false),
  completed_at: z.number().int().nullable().optional(),
  /** Pending-review overlay (web53a): how many ledger rows await manual
   * review, and whether confirming them all would finish the task. Absent
   * when nothing is pending (the common case). */
  pending: z.number().int().optional(),
  pending_complete: z.boolean().optional(),
});
export type EventProgress = z.infer<typeof EventProgressSchema>;

export const EventDetailSchema = EventSummarySchema.extend({
  tasks: z.array(EventTaskSchema).default([]),
  teams: z.array(EventTeamSchema).default([]),
  /** Per-team per-task rollups — powers 35/50-style public progress bars.
   * Absent on payloads from before the participant-UI pass. */
  progress: z.array(EventProgressSchema).optional(),
  bingo: BingoBoardSchema.nullable().optional(),
  /** Present (possibly null) for signed-in requesters; null when signed out. */
  viewer: EventViewerSchema.nullable().optional(),
  /** True when self-join requires a join code (the code itself never appears
   * on public reads). */
  join_requires_code: z.boolean().default(false),
  /** Whether the requester administers this event (group owner/admin or
   * superadmin) — drives review affordances in the Activity. Absent on
   * payloads from before the Activity review pass. */
  can_manage: z.boolean().optional(),
  /** Admin-only: present only when the requester administers the event. */
  join_code: z.string().nullable().optional(),
  discord_guild_id: z.string().nullable().optional(),
  /** Prize pot headline (web52a) — rides the event-detail SSE refresh so the
   * standings banner updates live. Full contributor list is GET
   * /events/{id}/pot. Absent on payloads from before the pot feature. */
  prize_pot: EventPrizePotSummarySchema.optional(),
});
export type EventDetail = z.infer<typeof EventDetailSchema>;

/** One reason an event can't activate yet. `target` names the manager section
 * to fix it in (teams / board / tasks / dates) so the UI can link there. */
export const EventReadinessBlockerSchema = z.object({
  code: z.string(),
  message: z.string(),
  /** Manager section to fix it in: teams / board / tasks / dates. */
  target: z.string(),
});
export type EventReadinessBlocker = z.infer<typeof EventReadinessBlockerSchema>;

/** GET /events/{id}/readiness — pre-flight of the activation checks. */
export const EventReadinessSchema = z.object({
  status: z.string(),
  ready: z.boolean(),
  blockers: z.array(EventReadinessBlockerSchema),
  starts_at: z.number().int().nullable().optional(),
  auto_start: z.boolean().default(false),
  already_active: z.boolean().default(false),
});
export type EventReadiness = z.infer<typeof EventReadinessSchema>;

/** GET /events/{id}/teams/{teamId} — public team page payload. */
export const EventTeamTaskSchema = EventTaskSchema.extend({
  progress: z.number().int().default(0),
  completed: z.boolean().default(false),
  completed_at: z.number().int().nullable().optional(),
});
export type EventTeamTask = z.infer<typeof EventTeamTaskSchema>;

/** Roster entry + contribution rollup from the applied ledger. */
export const EventTeamMemberStatsSchema = EventMemberSchema.extend({
  completions: z.number().int().default(0),
  quantity: z.number().int().default(0),
  /** Contribution points: sum of (task points × net share) over completed tasks. */
  points: z.number().default(0),
});
export type EventTeamMemberStats = z.infer<typeof EventTeamMemberStatsSchema>;

/** One applied ledger row, public-safe (no notes / proof URLs). */
export const EventTeamActivitySchema = z.object({
  id: z.number().int(),
  task_id: z.number().int(),
  task_label: z.string().nullable().optional(),
  player_id: z.number().int().nullable(),
  player_name: z.string().nullable().optional(),
  quantity: z.number().int().default(1),
  source_type: z.string().nullable().optional(),
  /** Item name this row credited (item tasks), e.g. "Bones" on a collect-all. */
  matched_target: z.string().nullable().optional(),
  created_at: z.number().int().nullable(),
});
export type EventTeamActivity = z.infer<typeof EventTeamActivitySchema>;

export const EventTeamDetailSchema = z.object({
  event: EventSummarySchema,
  team: z.object({
    id: z.number().int(),
    name: z.string(),
    score: z.number().int().default(0),
    group_id: z.number().int().nullable().optional(),
    /** Admin-assigned accent color ("#rrggbb"); null = palette default. */
    color: z.string().nullable().optional(),
    rank: z.number().int(),
    team_count: z.number().int(),
    member_count: z.number().int().default(0),
  }),
  members: z.array(EventTeamMemberStatsSchema).default([]),
  tasks: z.array(EventTeamTaskSchema).default([]),
  activity: z.array(EventTeamActivitySchema).default([]),
  /** Signed-in roster context (web48a): the viewer's player on THIS team,
   * their leadership role, their live election vote, and admin standing. */
  viewer: z
    .object({
      player_id: z.number().int().nullable(),
      role: z.enum(EVENT_TEAM_ROLES).nullable().optional(),
      vote: z.number().int().nullable().optional(),
      is_admin: z.boolean().default(false),
    })
    .nullable()
    .optional(),
});
export type EventTeamDetail = z.infer<typeof EventTeamDetailSchema>;

/* -------------------------------------------------------------------------- */
/* Task detail breakdown — GET /events/{id}/tasks/{taskId}/breakdown          */
/* Per-(task, team) item-level "what's obtained / what's left" view,          */
/* reconstructed from the applied completion ledger (web_api/event_breakdown).*/
/* -------------------------------------------------------------------------- */

/** One item on a requirement's have/need checklist. `obtained ≥ required`
 * ⇒ satisfied. `icon` reuses the resolved tile icon ref (compose the art with
 * the same `/img/{itemdb|npcdb|metrics}` sources the tiles use). */
export const TaskBreakdownItemSchema = z.object({
  name: z.string(),
  icon: TaskTileIconSchema.nullable().optional(),
  required: z.number().int().default(1),
  obtained: z.number().int().default(0),
  satisfied: z.boolean().default(false),
  /** point_collection weight, when the task scores by points. */
  points: z.number().optional(),
  /** Pending-review overlay (web53a): quantity awaiting review, and whether
   * confirming it would satisfy this item. */
  pending: z.number().int().optional(),
  pending_satisfied: z.boolean().optional(),
});
export type TaskBreakdownItem = z.infer<typeof TaskBreakdownItemSchema>;

/** One requirement bucket. `mode`: all_of (distinct items), any_of (N of a
 * list), points (weighted), count (single-target running tally). */
export const TaskBreakdownGroupSchema = z.object({
  mode: z.enum(["all_of", "any_of", "points", "count"]),
  need: z.number().int().default(0),
  obtained: z.number().int().default(0),
  satisfied: z.boolean().default(false),
  /** Unit for the bucket total, e.g. "pts" for point_collection. */
  unit: z.string().optional(),
  items: z.array(TaskBreakdownItemSchema).default([]),
  /** Pending-review overlay (web53a): confirming the pending rows would
   * satisfy this whole bucket. */
  pending_satisfied: z.boolean().optional(),
});
export type TaskBreakdownGroup = z.infer<typeof TaskBreakdownGroupSchema>;

/** One either-or path of an `any_path` task. `closest` marks the path the team
 * is furthest along (dryness-protection tasks complete when ANY path fills). */
export const TaskBreakdownPathSchema = z.object({
  label: z.string(),
  closest: z.boolean().default(false),
  pct: z.number().int().default(0),
  need: z.number().int().default(0),
  got: z.number().int().default(0),
  groups: z.array(TaskBreakdownGroupSchema).default([]),
});
export type TaskBreakdownPath = z.infer<typeof TaskBreakdownPathSchema>;

/** Single progress meter for non-item tasks (kc/xp/pb/skill/ehp/ehb/loot). */
export const TaskBreakdownMeterSchema = z.object({
  progress: z.number().int().default(0),
  target: z.number().int().default(1),
  unit: z.string().default(""),
  /** pb/skill tasks are pass/fail — render as complete / not yet, not a bar. */
  binary: z.boolean().default(false),
  label: z.string().nullable().optional(),
  target_value: z.number().int().nullable().optional(),
  /** Pending-review overlay (web53a): meter amount awaiting review. */
  pending: z.number().int().optional(),
});
export type TaskBreakdownMeter = z.infer<typeof TaskBreakdownMeterSchema>;

/** A contributor's applied contributions to this (task, team). `items` groups
 * by credited item name (`null` = a wildcard/manual award with no item). */
export const TaskBreakdownContributorSchema = z.object({
  player_id: z.number().int().nullable(),
  player_name: z.string().nullable().optional(),
  quantity: z.number().int().default(0),
  items: z
    .array(
      z.object({
        name: z.string().nullable(),
        quantity: z.number().int().default(1),
      }),
    )
    .default([]),
  last_at: z.number().int().nullable().optional(),
});
export type TaskBreakdownContributor = z.infer<typeof TaskBreakdownContributorSchema>;

export const TaskBreakdownSchema = z.object({
  task_id: z.number().int(),
  team_id: z.number().int(),
  team_name: z.string().nullable().optional(),
  type: z.enum(EVENT_TASK_TYPES),
  /** Requirement config kind (any_of/all_of/assembly/point_collection/groups/
   * any_path), or null for single-target / non-item tasks. */
  kind: z.string().nullable().optional(),
  progress: z.number().int().default(0),
  target: z.number().int().default(1),
  completed: z.boolean().default(false),
  /** Manual wildcard awards folded into progress (no specific item). */
  wildcard: z.number().int().default(0),
  /** Which shape to render: item checklist, either-or paths, or a lone meter. */
  structure: z.enum(["checklist", "paths", "meter"]),
  groups: z.array(TaskBreakdownGroupSchema).optional(),
  paths: z.array(TaskBreakdownPathSchema).optional(),
  meter: TaskBreakdownMeterSchema.nullable().optional(),
  contributors: z.array(TaskBreakdownContributorSchema).default([]),
  /** Pending-review overlay (web53a). */
  pending_count: z.number().int().optional(),
  pending_complete: z.boolean().optional(),
});
export type TaskBreakdown = z.infer<typeof TaskBreakdownSchema>;

export const EventInputSchema = z.object({
  /** null ⇒ global event (superadmin only). */
  group_id: z.number().int().nullable(),
  /** clan_vs_clan requires a non-null group_id (the host clan). */
  mode: z.enum(EVENT_MODES).optional(),
  /** Game format; the backend gates restricted kinds at create time. */
  kind: z.enum(EVENT_KINDS).optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  /** Keep the event private (participating-group members + admins only). */
  visibility: z.enum(EVENT_VISIBILITIES).optional(),
  starts_at: z.number().int().nullable().optional(),
  ends_at: z.number().int().nullable().optional(),
  formation_mode: z.enum(EVENT_FORMATION_MODES).optional(),
  requires_confirmation: z.boolean().optional(),
  submission_policy: z.enum(EVENT_SUBMISSION_POLICIES).optional(),
  join_code: z.string().max(32).nullable().optional(),
  board_size: z.number().int().min(3).max(7).optional(),
  bonus_line_points: z.number().int().nonnegative().optional(),
  bonus_blackout_points: z.number().int().nonnegative().optional(),
  /** When the Discord scheduled event is created (default: on_activate). */
  discord_event_policy: z.enum(EVENT_DISCORD_POLICIES).optional(),
  /** Role ids to ping per slot (max 10 each). */
  pings: z.record(z.enum(EVENT_PING_KEYS), z.array(z.string().regex(/^\d+$/)).max(10)).optional(),
  /** Team-leadership knobs (web48a); partial objects merge server-side. */
  leadership: z
    .object({
      enabled: z.boolean().optional(),
      co_leaders: z.boolean().optional(),
      selection: z.enum(["admin", "election"]).optional(),
    })
    .optional(),
});
export type EventInput = z.infer<typeof EventInputSchema>;

export const EventTaskInputSchema = z.object({
  type: z.enum(EVENT_TASK_TYPES),
  label: z.string().min(1),
  target: z.string().optional(),
  target_value: z.number().int().nonnegative().optional(),
  points: z.number().int().nonnegative().default(0),
  requires_confirmation: z.boolean().optional(),
  /** Library-copy publicity; the API defaults an absent value to "public". */
  visibility: z.enum(EVENT_TASK_VISIBILITIES).optional(),
  /** Board-game tier (web44a): tags the task into difficulty-tile roll pools. */
  difficulty: z.enum(EVENT_TASK_DIFFICULTIES).nullable().optional(),
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
  /** When present, re-saves the task's library copy with this publicity;
   * absent ⇒ the library copy is left alone. */
  visibility: z.enum(EVENT_TASK_VISIBILITIES).optional(),
  /** Board-game tier (web44a); explicit null clears it. */
  difficulty: z.enum(EVENT_TASK_DIFFICULTIES).nullable().optional(),
  /** JSON string — replaces the item-list / source-NPC config (revalidated
   * server-side). Explicit null switches an item_collection back to
   * single-item semantics; absent ⇒ unchanged. */
  config: z.string().nullable().optional(),
});
export type EventTaskPatch = z.infer<typeof EventTaskPatchSchema>;

/** POST /events/{id}/award — manual ledger row + immediate apply (events-prd.md
 * D10: the retro-credit escape hatch; also completes custom/ehp/ehb tasks). */
export const EventAwardInputSchema = z.object({
  task_id: z.number().int(),
  team_id: z.number().int(),
  quantity: z.number().int().positive().optional(),
  /** True ⇒ server sizes the award to whatever progress remains, so this one
   * row completes the task (instead of adding `quantity` toward it). */
  complete: z.boolean().optional(),
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

/** GET /events/pending-review — one active event the session user administers
 * that has completions awaiting confirmation. `completions` is a newest-first
 * preview (capped upstream); `pending_count` is the true total. Powers the
 * Discord Activity's review pop-up and badges. */
export const PendingReviewEventSchema = z.object({
  event_id: z.number().int(),
  event_name: z.string(),
  group_id: z.number().int().nullable(),
  pending_count: z.number().int(),
  completions: z.array(EventCompletionSchema).default([]),
});
export type PendingReviewEvent = z.infer<typeof PendingReviewEventSchema>;

/** Discord scheduled-event mirror state for the event's target guild
 * (web_event_guilds; the bot creates/edits the real Discord event and writes
 * the state back). `failed` + `last_error` usually means the bot lacks the
 * Manage Events permission in that server. */
export const EventScheduledEventStateSchema = z.object({
  id: z.string().nullable(),
  status: z.enum(["pending", "synced", "delete_pending", "failed"]),
  last_error: z.string().nullable().optional(),
});
export type EventScheduledEventState = z.infer<typeof EventScheduledEventStateSchema>;

/** Per-event message verbosity + live-leaderboard knobs
 * (web_events.message_config). GET always returns this fully merged with the
 * server defaults, so the UI never needs its own default table; the PUT body
 * carries the same shape back. */
export const EventMessageConfigSchema = z.object({
  toggles: z.object({
    event_started: z.boolean(),
    event_ended: z.boolean(),
    event_completion: z.boolean(),
    event_task_progress: z.boolean(),
    event_line: z.boolean(),
    event_blackout: z.boolean(),
    event_lead_change: z.boolean(),
    event_pending: z.boolean(),
    event_activation_failed: z.boolean(),
    /** Board game: optional so pre-web53a payloads keep parsing; the server
     * always returns them merged (defaults: dice rolls ON, roll prompts OFF —
     * roll prompts are team-channel-first). */
    event_board_turn: z.boolean().optional(),
    event_board_roll_prompt: z.boolean().optional(),
  }),
  task_progress: z.enum(EVENT_TASK_PROGRESS_MODES),
  /** Verbose completion detail: include the item that finished the task and
   * how much of the requirement it filled on completion posts. Default on. */
  item_details: z.boolean(),
  leaderboard: z.object({
    live: z.boolean(),
    top_n: z.number().int().min(3).max(25),
    show_tasks: z.boolean(),
  }),
});
export type EventMessageConfig = z.infer<typeof EventMessageConfigSchema>;

/** Per-event Discord destinations (events-prd.md D8). */
export const EventChannelConfigSchema = z.object({
  guild_id: z.string().nullable(),
  guild_name: z.string().nullable().optional(),
  channels: z.record(z.enum(EVENT_CHANNEL_KINDS), z.string()).default({}),
  scheduled_event: EventScheduledEventStateSchema.nullable().optional(),
  discord_event_policy: z.enum(EVENT_DISCORD_POLICIES).default("on_activate"),
  pings: z.record(z.enum(EVENT_PING_KEYS), z.array(z.string())).default({}),
  messages: EventMessageConfigSchema,
  /** web48a: whether each clan runs its own Discord config, and which scope
   * this payload is (null = the shared/host scope). */
  per_group_discord: z.boolean().default(false),
  group_id: z.number().int().nullable().optional(),
  /** Shared scope of a clan-vs-clan event only: participating-clan scopes. */
  groups: z
    .array(
      z.object({
        group_id: z.number().int(),
        name: z.string().nullable().optional(),
        role: z.string().optional(),
        configured: z.boolean().default(false),
        guild_id: z.string().nullable().optional(),
      }),
    )
    .optional(),
  /** Participating clans the viewer administers (shared scope only). */
  my_group_ids: z.array(z.number().int()).optional(),
  is_host_admin: z.boolean().optional(),
});
export type EventChannelConfig = z.infer<typeof EventChannelConfigSchema>;

/** One notification-destination kind (announcements/completions/leaderboard/admin). */
export type EventChannelKind = (typeof EVENT_CHANNEL_KINDS)[number];

/** PUT /events/{id}/discord — set (or clear, with guild_id null) the event's
 * Discord destination. Snowflakes travel as digit strings. */
export const EventChannelConfigInputSchema = z.object({
  guild_id: z.string().regex(/^\d+$/, "Discord ids are numeric").nullable(),
  channels: z.record(z.enum(EVENT_CHANNEL_KINDS), z.string().regex(/^\d+$/)).default({}),
  /** Absent keys leave the stored value unchanged (backend contract). */
  discord_event_policy: z.enum(EVENT_DISCORD_POLICIES).optional(),
  pings: z.record(z.enum(EVENT_PING_KEYS), z.array(z.string().regex(/^\d+$/)).max(10)).optional(),
  messages: EventMessageConfigSchema.optional(),
  /** web48a: write a clan's own scope instead of the shared one. Event-level
   * fields (policy/pings/per_group_discord) are rejected with a group_id. */
  group_id: z.number().int().nullable().optional(),
  /** Host admins only, shared scope only. */
  per_group_discord: z.boolean().optional(),
});
export type EventChannelConfigInput = z.infer<typeof EventChannelConfigInputSchema>;

/* -------------------------------------------------------------------------- */
/* Per-team Discord channels & roles (web53a)                                 */
/* GET/PUT /events/{id}/team-discord (+ ?group_id= clan scope),               */
/* PUT /events/{id}/teams/{teamId}/notifications (captain/admin).             */
/* -------------------------------------------------------------------------- */

/** What happens to the auto-created team roles/channels when the event ends
 * naturally: torn down after a ~48h grace window (pings stay usable for
 * wrap-up), or kept forever. Hard delete always tears down immediately. */
export const EVENT_TEAM_DISCORD_RETENTIONS = ["delete_48h", "keep"] as const;
export type EventTeamDiscordRetention = (typeof EVENT_TEAM_DISCORD_RETENTIONS)[number];

/** Notification types a team channel can receive (captain-tunable). */
export const TEAM_MESSAGE_TOGGLE_KEYS = [
  "event_completion",
  "event_task_progress",
  "event_line",
  "event_blackout",
  "event_lead_change",
  "event_board_turn",
  "event_board_roll_prompt",
] as const;
export type TeamMessageToggleKey = (typeof TEAM_MESSAGE_TOGGLE_KEYS)[number];

/** One team's provisioning state + effective per-team knobs. role_id/
 * channel_id/sync_status are written back by the bot ("pending" ⇒ it will
 * create them within ~30s; "failed" carries last_error). */
export const TeamDiscordTeamStateSchema = z.object({
  team_id: z.number().int(),
  name: z.string(),
  role_enabled: z.boolean(),
  channel_enabled: z.boolean(),
  toggles: z.record(z.string(), z.boolean()).default({}),
  task_progress: z.enum(EVENT_TASK_PROGRESS_MODES).default("all"),
  role_id: z.string().nullable().optional(),
  channel_id: z.string().nullable().optional(),
  channel_kind: z.enum(["text", "thread"]).nullable().optional(),
  sync_status: z
    .enum(["pending", "synced", "delete_pending", "failed"])
    .nullable()
    .optional(),
  last_error: z.string().nullable().optional(),
});
export type TeamDiscordTeamState = z.infer<typeof TeamDiscordTeamStateSchema>;

/** One scope of the team-discord config: the shared/host scope (group_id
 * null, targeting the event's guild) or a participating clan's own scope. */
export const EventTeamDiscordConfigSchema = z.object({
  group_id: z.number().int().nullable(),
  guild_id: z.string().nullable(),
  channels_enabled: z.boolean(),
  roles_enabled: z.boolean(),
  /** Forum-channel snowflake ⇒ team channels are threads inside it. */
  forum_channel_id: z.string().nullable(),
  retention: z.enum(EVENT_TEAM_DISCORD_RETENTIONS),
  /** Team captains (leadership feature) may tune their team's toggles. */
  captain_config: z.boolean(),
  teams: z.array(TeamDiscordTeamStateSchema).default([]),
  default_toggles: z.record(z.string(), z.boolean()).default({}),
  default_task_progress: z.enum(EVENT_TASK_PROGRESS_MODES).default("all"),
});
export type EventTeamDiscordConfig = z.infer<typeof EventTeamDiscordConfigSchema>;

/** PUT /events/{id}/team-discord — absent keys leave stored values unchanged;
 * per-team entries merge key-wise (captain toggles survive admin saves). */
export const EventTeamDiscordInputSchema = z.object({
  group_id: z.number().int().nullable().optional(),
  channels_enabled: z.boolean().optional(),
  roles_enabled: z.boolean().optional(),
  forum_channel_id: z.string().regex(/^\d+$/).nullable().optional(),
  retention: z.enum(EVENT_TEAM_DISCORD_RETENTIONS).optional(),
  captain_config: z.boolean().optional(),
  teams: z
    .record(
      z.string(),
      z.object({ role: z.boolean().optional(), channel: z.boolean().optional() }),
    )
    .optional(),
});
export type EventTeamDiscordInput = z.infer<typeof EventTeamDiscordInputSchema>;

/** PUT /events/{id}/teams/{teamId}/notifications response (and input shape:
 * {toggles?, task_progress?}). */
export const TeamNotificationsSchema = z.object({
  team_id: z.number().int(),
  toggles: z.record(z.string(), z.boolean()).default({}),
  task_progress: z.enum(EVENT_TASK_PROGRESS_MODES).default("all"),
});
export type TeamNotifications = z.infer<typeof TeamNotificationsSchema>;

/** Reusable task preset: a curated seed (`source: "legacy_v1"`) or a
 * group-saved task (`source: "group"`). Private rows only reach admins of the
 * owning group; everything else in the listing is public. */
export const EventTaskLibraryItemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable().optional(),
  type: z.enum(EVENT_TASK_TYPES),
  target: z.string().nullable().optional(),
  target_value: z.number().int().nullable().optional(),
  default_points: z.number().int().default(0),
  /** Board-game tier — the backend validates against the same four values. */
  difficulty: z.enum(EVENT_TASK_DIFFICULTIES).nullable().optional(),
  config: z.string().nullable().optional(),
  source: z.string().optional(),
  /** Owning group for group-saved rows; null = site-wide/curated. */
  group_id: z.number().int().nullable().optional(),
  visibility: z.enum(EVENT_TASK_VISIBILITIES).default("public"),
});
export type EventTaskLibraryItem = z.infer<typeof EventTaskLibraryItemSchema>;

/** GET /events/meta/items | /events/meta/npcs — task-form autocomplete rows.
 * `id` is the game id (itemdb/npcdb icon key), `name` the exact in-game name.
 * Also the row shape of /events/meta/resolve (batch name → id, icon
 * hydration for stored task lists). */
export const EventMetaEntrySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  /** Item search only: false = never seen in the drop history (catalog-only
   * fallback rows — a task targeting one may be uncompletable). */
  tracked: z.boolean().optional(),
});
export type EventMetaEntry = z.infer<typeof EventMetaEntrySchema>;

/** POST /event-task-library — create a curated site-wide preset (superadmin).
 * Goal fields (target/target_value/config) are revalidated per type exactly
 * like an event task, so a preset that saves is a preset that instantiates. */
export const EventTaskLibraryItemInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  type: z.enum(EVENT_TASK_TYPES),
  target: z.string().nullable().optional(),
  target_value: z.number().int().nonnegative().nullable().optional(),
  default_points: z.number().int().nonnegative().optional(),
  difficulty: z.enum(EVENT_TASK_DIFFICULTIES).nullable().optional(),
  /** JSON string: any_of/all_of/point_collection item lists, source NPCs… */
  config: z.string().nullable().optional(),
  visibility: z.enum(EVENT_TASK_VISIBILITIES).optional(),
});
export type EventTaskLibraryItemInput = z.infer<typeof EventTaskLibraryItemInputSchema>;

/** PATCH /event-task-library/{id} — absent keys are left unchanged. */
export const EventTaskLibraryItemPatchSchema = EventTaskLibraryItemInputSchema.partial();
export type EventTaskLibraryItemPatch = z.infer<typeof EventTaskLibraryItemPatchSchema>;

/** Saved event structure — the whole-event analogue of the task library
 * ("save/rerun events"). Public rows reach every clan's picker; private rows
 * only the owning group's admins. The snapshot itself stays server-side —
 * instantiation happens on the backend. */
export const EventTemplateSummarySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable().optional(),
  source_event_id: z.number().int().nullable().optional(),
  /** Owning group; null = site-wide (saved from a global event). */
  group_id: z.number().int().nullable().optional(),
  visibility: z.enum(EVENT_TASK_VISIBILITIES).default("private"),
  /** Source event's mode — informational; instantiation always yields a
   * standard draft (clan bindings/invites are per-run). */
  mode: z.enum(EVENT_MODES).default("standard"),
  has_bingo: z.boolean().default(false),
  board_size: z.number().int().default(5),
  task_count: z.number().int().default(0),
  team_count: z.number().int().default(0),
  times_used: z.number().int().default(0),
  created_at: z.number().int().nullable().optional(),
  updated_at: z.number().int().nullable().optional(),
});
export type EventTemplateSummary = z.infer<typeof EventTemplateSummarySchema>;

/** GET /event-templates/{id} — summary + picker preview. Preview task `type`
 * is a plain string: old snapshots may carry types the current enum dropped,
 * and a stale preview row must not fail the whole response. */
export const EventTemplateDetailSchema = EventTemplateSummarySchema.extend({
  preview: z.object({
    description: z.string().nullable().optional(),
    formation_mode: z.enum(EVENT_FORMATION_MODES).default("admin_assign"),
    requires_confirmation: z.boolean().default(false),
    submission_policy: z.enum(EVENT_SUBMISSION_POLICIES).default("all"),
    bonus_line_points: z.number().int().default(0),
    bonus_blackout_points: z.number().int().default(0),
    tasks: z.array(
      z.object({
        type: z.string(),
        label: z.string().nullable().optional(),
        target: z.string().nullable().optional(),
        target_value: z.number().int().nullable().optional(),
        points: z.number().int().default(0),
      }),
    ),
    teams: z.array(z.string()),
  }),
});
export type EventTemplateDetail = z.infer<typeof EventTemplateDetailSchema>;

/** POST /events/{id}/save-template — upserts per owning group by lower-cased
 * name (re-saving a same-named template updates it, task-library semantics). */
export const EventTemplateSaveInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  visibility: z.enum(EVENT_TASK_VISIBILITIES).default("private"),
  /** Carry team names (never members) into the template. */
  include_teams: z.boolean().default(true),
});
export type EventTemplateSaveInput = z.infer<typeof EventTemplateSaveInputSchema>;

/** POST /event-templates/{id}/instantiate → a fresh standard draft. */
export const EventTemplateInstantiateInputSchema = z.object({
  group_id: z.number().int().nullable(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  starts_at: z.number().int().nullable().optional(),
  ends_at: z.number().int().nullable().optional(),
  include_teams: z.boolean().optional(),
});
export type EventTemplateInstantiateInput = z.infer<typeof EventTemplateInstantiateInputSchema>;

export const EventTemplateInstantiateResultSchema = z.object({
  id: z.number().int(),
  /** Tasks that no longer validate (renamed items/NPCs, tightened rules) —
   * skipped on instantiate; their bingo cells survive unbound so the
   * designer can rebind them. */
  skipped_tasks: z.array(
    z.object({
      index: z.number().int(),
      label: z.string(),
      reason: z.string(),
    }),
  ),
});
export type EventTemplateInstantiateResult = z.infer<typeof EventTemplateInstantiateResultSchema>;

/** PATCH /event-templates/{id} — rename / re-describe / re-scope. */
export const EventTemplatePatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  visibility: z.enum(EVENT_TASK_VISIBILITIES).optional(),
});
export type EventTemplatePatch = z.infer<typeof EventTemplatePatchSchema>;

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
    size: z
      .number()
      .int()
      .refine((n) => (EVENT_BOARD_SIZES as readonly number[]).includes(n), {
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
    if (
      idxs.size !== board.cells.length ||
      [...idxs].some((i) => i < 0 || i >= board.cells.length)
    ) {
      ctx.addIssue({
        code: "custom",
        message: `Cell idx values must cover 0…${board.cells.length - 1} exactly once.`,
      });
    }
  });
export type BingoBoardInput = z.infer<typeof BingoBoardInputSchema>;

export const EventTeamInputSchema = z.object({
  name: z.string().min(1).max(80),
  /** Required on clan_vs_clan events: the accepted participant clan this
   * team represents. Omit for standard/global events. */
  group_id: z.number().int().optional(),
});
export type EventTeamInput = z.infer<typeof EventTeamInputSchema>;

/** Editable fields of an existing team — cosmetics only (the clan a
 * clan_vs_clan team represents is fixed at create time). `color` is
 * "#rrggbb", or null to reset to the palette default. */
export const EventTeamPatchSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be "#rrggbb" hex')
      .nullable()
      .optional(),
    /** Board-game piece: an OSRS item id (null clears it). */
    piece_item_id: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (p) => p.name !== undefined || p.color !== undefined || p.piece_item_id !== undefined,
    { message: "Provide a name, color, and/or piece" },
  );
export type EventTeamPatch = z.infer<typeof EventTeamPatchSchema>;

/** Per-name outcomes of the bulk "paste a list of names" roster add. Skipped
 * rows carry a human-readable reason (not tracked / wrong clan / already
 * placed); the endpoint never moves a player between teams. */
export const EventTeamBulkAddResultSchema = z.object({
  added: z.array(z.object({ id: z.number().int(), name: z.string() })),
  skipped: z.array(z.object({ name: z.string(), reason: z.string() })),
});
export type EventTeamBulkAddResult = z.infer<typeof EventTeamBulkAddResultSchema>;

// --- Clan-vs-clan participants (Implementation Plan B) -----------------------

/** One clan on a clan-vs-clan event's roster (GET /events/{id}/participants). */
export const EventParticipantSchema = z.object({
  group_id: z.number().int(),
  group_name: z.string().nullable().optional(),
  role: z.enum(EVENT_PARTICIPANT_ROLES),
  status: z.enum(EVENT_PARTICIPANT_STATUSES),
  invited_at: z.number().int().nullable().optional(),
  responded_at: z.number().int().nullable().optional(),
});
export type EventParticipant = z.infer<typeof EventParticipantSchema>;

/** Invitation-inbox entry (GET /events/invitations): a pending invite for a
 * clan the caller administers. */
export const EventInvitationSchema = z.object({
  event: EventSummarySchema,
  group_id: z.number().int(),
  group_name: z.string().nullable().optional(),
  host_group_name: z.string().nullable().optional(),
  invited_at: z.number().int().nullable().optional(),
});
export type EventInvitation = z.infer<typeof EventInvitationSchema>;

/** Recruiting-banner entry (GET /events/recruiting): a clan-vs-clan event one
 * of the caller's clans participates in, open to member opt-in. */
export const EventRecruitingItemSchema = z.object({
  event: EventSummarySchema,
  group_id: z.number().int(),
  group_name: z.string().nullable().optional(),
});
export type EventRecruitingItem = z.infer<typeof EventRecruitingItemSchema>;

// --- Sign-up pool (formation_mode === "signup_pool") -------------------------

/** One entry in the sign-up pool (GET /events/{id}/signups): a player who
 * opted in, with their current team placement (null while unassigned). */
export const EventSignupSchema = z.object({
  player_id: z.number().int(),
  player_name: z.string(),
  group_id: z.number().int().nullable().optional(),
  group_name: z.string().nullable().optional(),
  team_id: z.number().int().nullable(),
  source: z.enum(["web", "discord"]).default("web"),
  signed_up_at: z.number().int().nullable().optional(),
});
export type EventSignup = z.infer<typeof EventSignupSchema>;

/** POST /events/{id}/join response — team_id is null when the event pools
 * sign-ups (`pooled` true) rather than placing immediately. */
export const EventJoinResultSchema = z.object({
  team_id: z.number().int().nullable().optional(),
  pooled: z.boolean().optional(),
});
export type EventJoinResult = z.infer<typeof EventJoinResultSchema>;

/** POST /events/{id}/signups/randomize response. */
export const EventRandomizeResultSchema = z.object({
  assigned: z.number().int(),
  unassigned: z.number().int(),
});
export type EventRandomizeResult = z.infer<typeof EventRandomizeResultSchema>;

/** POST /events/{id}/populate-random response — admin scale/testing tool that
 * bulk-fills teams with random active members (balanced, clan-aware). */
export const EventPopulateResultSchema = z.object({
  added: z.number().int(),
  source: z.enum(["group", "global"]),
  teams: z.array(
    z.object({
      team_id: z.number().int(),
      team_name: z.string(),
      added: z.number().int(),
      member_count: z.number().int(),
    }),
  ),
});
export type EventPopulateResult = z.infer<typeof EventPopulateResultSchema>;

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

// --------------------------------------------------------------------------
// Support tickets (web21a) — created and answered in Discord, archived here.
// Transcript messages are mirrored from the ticket's Discord channel; the
// channel itself is deleted at close time, so this is the permanent record.
// --------------------------------------------------------------------------

/** "closing" = close requested from the web, bot archive pass pending. */
export const TicketStatusSchema = z.enum(["open", "closing", "closed"]);
export type TicketStatus = z.infer<typeof TicketStatusSchema>;

export const TicketTypeSchema = z.enum(["players", "clans", "support", "other"]);
export type TicketType = z.infer<typeof TicketTypeSchema>;

export const TicketSummarySchema = z.object({
  ticket_id: z.number().int(),
  type: TicketTypeSchema,
  status: TicketStatusSchema,
  subject: z.string().nullable(),
  created_by: z.number().int(),
  created_by_name: z.string().nullable(),
  claimed_by: z.number().int().nullable(),
  claimed_by_name: z.string().nullable(),
  closed_by: z.number().int().nullable(),
  closed_by_name: z.string().nullable(),
  message_count: z.number().int(),
  date_added: z.number().int().nullable(),
  date_updated: z.number().int().nullable(),
  date_closed: z.number().int().nullable(),
});
export type TicketSummary = z.infer<typeof TicketSummarySchema>;

export const TicketPageSchema = z.object({
  items: z.array(TicketSummarySchema),
  meta: PageMetaSchema,
});
export type TicketPage = z.infer<typeof TicketPageSchema>;

export const TicketAttachmentSchema = z.object({
  filename: z.string(),
  /** /img/tickets/... when mirrored locally; a Discord CDN URL otherwise. */
  url: z.string().nullable(),
  content_type: z.string().nullable().optional(),
  size: z.number().int().nullable().optional(),
});
export type TicketAttachment = z.infer<typeof TicketAttachmentSchema>;

/** Discord user-id → display name, for resolving `<@id>` mentions embedded in
 * mirrored message content. Keyed by Discord id (string); only ids the backend
 * could resolve to a known user are present. Defaults to `{}` for backward
 * compatibility with responses/mocks that predate the field. */
export const MentionMapSchema = z.record(z.string(), z.string()).default({});
export type MentionMap = z.infer<typeof MentionMapSchema>;

export const TicketMessageSchema = z.object({
  id: z.number().int(),
  author_name: z.string(),
  author_user_id: z.number().int().nullable(),
  is_staff: z.boolean(),
  is_bot: z.boolean(),
  kind: z.enum(["message", "system"]),
  content: z.string(),
  attachments: z.array(TicketAttachmentSchema),
  date_sent: z.number().int().nullable(),
  date_edited: z.number().int().nullable(),
});
export type TicketMessage = z.infer<typeof TicketMessageSchema>;

export const TicketDetailSchema = TicketSummarySchema.extend({
  messages: z.array(TicketMessageSchema),
  mentions: MentionMapSchema,
});
export type TicketDetail = z.infer<typeof TicketDetailSchema>;

export const TicketStatsSchema = z.object({
  open: z.number().int(),
  unclaimed: z.number().int(),
  closed: z.number().int(),
  total: z.number().int(),
  open_by_type: z.record(z.string(), z.number().int()),
});
export type TicketStats = z.infer<typeof TicketStatsSchema>;

export const AdminTicketPageSchema = TicketPageSchema.extend({
  stats: TicketStatsSchema,
});
export type AdminTicketPage = z.infer<typeof AdminTicketPageSchema>;

/** PATCH /admin/tickets/{id} body. */
export const TicketActionInputSchema = z.object({
  action: z.enum(["claim", "unclaim", "close"]),
});
export type TicketActionInput = z.infer<typeof TicketActionInputSchema>;

/* -------------------------------------------------------------------------- */
/* Suggestion forum (/suggestions) — threads mirrored two-way with Discord     */
/* -------------------------------------------------------------------------- */

export const SuggestionTypeSchema = z.enum(["suggestion", "bug"]);
export type SuggestionType = z.infer<typeof SuggestionTypeSchema>;

/** "pending" = queued for the Discord bot; "posted" = live forum thread. */
export const SuggestionStatusSchema = z.enum(["pending", "posted", "failed"]);
export type SuggestionStatus = z.infer<typeof SuggestionStatusSchema>;

/** Which side the thread was started on. */
export const SuggestionOriginSchema = z.enum(["web", "discord"]);
export type SuggestionOrigin = z.infer<typeof SuggestionOriginSchema>;

export const SuggestionSummarySchema = z.object({
  id: z.number().int(),
  type: SuggestionTypeSchema,
  title: z.string(),
  status: SuggestionStatusSchema,
  origin: SuggestionOriginSchema,
  is_open: z.boolean(),
  author_name: z.string(),
  author_user_id: z.number().int().nullable(),
  excerpt: z.string(),
  message_count: z.number().int(),
  discord_thread_url: z.string().nullable(),
  created_at: z.number().int().nullable(),
  last_activity_at: z.number().int().nullable(),
});
export type SuggestionSummary = z.infer<typeof SuggestionSummarySchema>;

export const SuggestionPageSchema = z.object({
  items: z.array(SuggestionSummarySchema),
  meta: PageMetaSchema,
});
export type SuggestionPage = z.infer<typeof SuggestionPageSchema>;

export const SuggestionMessageSchema = z.object({
  id: z.number().int(),
  author_name: z.string(),
  author_user_id: z.number().int().nullable(),
  source: SuggestionOriginSchema,
  content: z.string(),
  created_at: z.number().int().nullable(),
  edited_at: z.number().int().nullable(),
});
export type SuggestionMessage = z.infer<typeof SuggestionMessageSchema>;

export const SuggestionDetailSchema = SuggestionSummarySchema.extend({
  body_md: z.string(),
  messages: z.array(SuggestionMessageSchema),
  mentions: MentionMapSchema,
});
export type SuggestionDetail = z.infer<typeof SuggestionDetailSchema>;

/** POST /suggestions body. The title doubles as the Discord thread name. */
export const SuggestionCreateSchema = z.object({
  type: SuggestionTypeSchema,
  title: z.string().trim().min(5).max(100),
  body_md: z.string().trim().min(20).max(4000),
});
export type SuggestionCreate = z.infer<typeof SuggestionCreateSchema>;

/** POST /suggestions/{id}/messages body. */
export const SuggestionReplyCreateSchema = z.object({
  content: z.string().trim().min(2).max(1800),
});
export type SuggestionReplyCreate = z.infer<typeof SuggestionReplyCreateSchema>;

/* -------------------------------------------------------------------------- */
/* Custom group points system (/groups/{id}/points/*)                          */
/* -------------------------------------------------------------------------- */

export const PointRuleSchema = z.object({
  reason: z.string(),
  award: z.number().int(),
  divisor: z.number().int(),
  uses_divisor: z.boolean(),
  description: z.string(),
});
export type PointRule = z.infer<typeof PointRuleSchema>;

export const PointSharingMethodSchema = z.enum(["equal_split", "award_all"]);
export type PointSharingMethod = z.infer<typeof PointSharingMethodSchema>;

export const PointsBehaviorSchema = z.object({
  stacks_award_points: z.boolean(),
  point_sharing: z.boolean(),
  point_sharing_method: PointSharingMethodSchema,
  points_require_group_only: z.boolean(),
  points_leaderboard_public: z.boolean(),
  min_submission_pts: z.number().int(),
  max_submission_pts: z.number().int(),
});
export type PointsBehavior = z.infer<typeof PointsBehaviorSchema>;

export const PointSeasonSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  start_at: z.string().nullable(),
  end_at: z.string().nullable(),
  active: z.boolean(),
});
export type PointSeason = z.infer<typeof PointSeasonSchema>;

export const PointsSettingsSchema = z.object({
  enabled: z.boolean(),
  rules: z.array(PointRuleSchema),
  behavior: PointsBehaviorSchema,
  seasons: z.array(PointSeasonSchema),
});
export type PointsSettings = z.infer<typeof PointsSettingsSchema>;

export const PointModSchema = z.object({
  id: z.number().int(),
  item_id: z.number().int().nullable(),
  item_name: z.string().nullable(),
  npc_id: z.number().int().nullable(),
  npc_name: z.string().nullable(),
  event_type: z.string(),
  award: z.number().int(),
  divisor: z.number().int(),
  description: z.string(),
  can_modify: z.boolean(),
});
export type PointMod = z.infer<typeof PointModSchema>;

export const PointListTypeSchema = z.enum(["blacklist", "whitelist", "no_split"]);
export type PointListType = z.infer<typeof PointListTypeSchema>;

export const PointListEntrySchema = z.object({
  id: z.number().int(),
  list_type: PointListTypeSchema,
  item_id: z.number().int().nullable(),
  item_name: z.string().nullable(),
  npc_id: z.number().int().nullable(),
  npc_name: z.string().nullable(),
});
export type PointListEntry = z.infer<typeof PointListEntrySchema>;

export const PointBoostSchema = z.object({
  id: z.number().int(),
  start_at: z.string(),
  end_at: z.string(),
  event_type: z.string(),
  target_type: z.enum(["any", "item", "npc"]),
  target_id: z.number().int().nullable(),
  target_name: z.string().nullable(),
  operation: z.enum(["multiply", "add", "set"]),
  operation_value: z.number().int(),
  description: z.string(),
  active: z.boolean(),
});
export type PointBoost = z.infer<typeof PointBoostSchema>;

export const PointsHistoryEntrySchema = z.object({
  id: z.number().int(),
  player_id: z.number().int(),
  player_name: z.string(),
  amount: z.number().int(),
  reason: z.string(),
  manual: z.boolean(),
  date: z.string().nullable(),
});
export type PointsHistoryEntry = z.infer<typeof PointsHistoryEntrySchema>;

export const PointsHistoryPageSchema = z.object({
  entries: z.array(PointsHistoryEntrySchema),
  meta: PageMetaSchema,
});
export type PointsHistoryPage = z.infer<typeof PointsHistoryPageSchema>;

export const PointsLeaderboardEntrySchema = z.object({
  rank: z.number().int(),
  id: z.number().int(),
  name: z.string(),
  points: z.number().int(),
});
export type PointsLeaderboardEntry = z.infer<typeof PointsLeaderboardEntrySchema>;

export const PointsLeaderboardSchema = z.object({
  period: z.string(),
  group_id: z.number().int(),
  group_name: z.string(),
  entries: z.array(PointsLeaderboardEntrySchema),
  seasons: z.array(PointSeasonSchema),
  meta: PageMetaSchema,
});
export type PointsLeaderboard = z.infer<typeof PointsLeaderboardSchema>;

export const PointsAdjustResultSchema = z.object({
  entry_id: z.number().int(),
  player_id: z.number().int(),
  player_name: z.string(),
  amount: z.number().int(),
  new_total: z.number().int(),
});
export type PointsAdjustResult = z.infer<typeof PointsAdjustResultSchema>;

export * from "./group-config";
export * from "./entitlements";
export * from "./tier-flair";
