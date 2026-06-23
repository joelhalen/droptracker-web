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

export * from "./group-config";
