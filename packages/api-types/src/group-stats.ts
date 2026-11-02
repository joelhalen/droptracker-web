/**
 * Clan stats (backend `services/group_stats.py`, `GET /groups/{id}/stats`,
 * suggestion #224): everything a clan did over a month, a year or all time,
 * per member.
 *
 * Compact on the wire: names live once in `names` (player id -> name) and the
 * per-skill / per-boss / per-item breakdowns are tuples, because a 500-member
 * clan's full matrix is several thousand rows. Read with the helpers in
 * `apps/web/lib/group-stats.ts`.
 *
 * A `null` total means "we have no data for this", never zero: XP, levels,
 * kill counts, EHB and EHP need a Wise Old Man group (`coverage.wom`), items
 * and sources aren't available all-time, and the NPC rollup has a 2025-09 to
 * 2026-06 hole (`coverage.sources`). Hide what's null.
 */
import { z } from "zod";

const n = z.number();
const nn = z.number().nullable().optional();

export const GroupStatsMemberSchema = z.object({
  player_id: z.number().int(),
  loot: n,
  drops: n,
  xp: n.optional(),
  levels: n.optional(),
  /** All-time view only: current total level. */
  total_level: n.optional(),
  ehb: n.optional(),
  ehp: n.optional(),
  kills: n.optional(),
  clues: n.optional(),
  pbs: n,
  clog_slots: n,
  cas: n,
  pets: n,
  quests: n,
  diaries: n,
  deaths: n,
  slayer_tasks: n,
  pvp_kills: n,
  pvp_loot: n,
  active: z.boolean(),
});
export type GroupStatsMember = z.infer<typeof GroupStatsMemberSchema>;

export const StandoutEntrySchema = z.object({
  player_id: z.number().int(),
  value: n,
  /** Biggest drop: the item's name. */
  detail: z.string().nullable().optional(),
  item_id: z.number().int().nullable().optional(),
  /** Present on recap snapshots, where names are frozen into the card. */
  name: z.string().nullable().optional(),
});
export type StandoutEntry = z.infer<typeof StandoutEntrySchema>;

export const StandoutCategorySchema = z.object({
  key: z.string(),
  label: z.string(),
  unit: z.string(),
  entries: z.array(StandoutEntrySchema),
});
export type StandoutCategory = z.infer<typeof StandoutCategorySchema>;

export const StandoutLeaderSchema = z.object({
  metric: z.string(),
  total: n,
  entries: z.array(StandoutEntrySchema),
});
export type StandoutLeader = z.infer<typeof StandoutLeaderSchema>;

export const StandoutsSchema = z.object({
  categories: z.array(StandoutCategorySchema).default([]),
  skills: z.array(StandoutLeaderSchema).default([]),
  bosses: z.array(StandoutLeaderSchema).default([]),
});
export type Standouts = z.infer<typeof StandoutsSchema>;

const FeedBase = { player_id: z.number().int(), date: z.string().nullable() };

export const GroupStatsSchema = z.object({
  group: z.object({ id: z.number().int(), name: z.string().nullable(), wom_linked: z.boolean() }),
  period: z.string(),
  kind: z.enum(["month", "year", "all"]),
  months: z.array(z.string()),
  in_progress: z.boolean(),
  data_since: z.string(),
  generated_at: z.string(),
  coverage: z.object({
    wom: z.enum(["stored", "live", "partial", "missing", "unlinked"]),
    wom_months: z.array(z.string()).default([]),
    sources: z.boolean(),
    items: z.boolean(),
  }),
  names: z.record(z.string(), z.string().nullable()),
  totals: z.object({
    members_total: n,
    members_active: n,
    loot: nn,
    drops: nn,
    unique_items: nn,
    xp: nn,
    levels: nn,
    ehb: nn,
    ehp: nn,
    kills: nn,
    clues: nn,
    pvp_loot: nn,
    pbs: nn,
    clog_slots: nn,
    cas: nn,
    pets: nn,
    quests: nn,
    diaries: nn,
    deaths: nn,
    slayer_tasks: nn,
    pvp_kills: nn,
  }),
  members: z.array(GroupStatsMemberSchema),
  standouts: StandoutsSchema,
  /** members: [player_id, xp, levels (month/year) or level (all-time)]. */
  skills: z.array(z.object({
    metric: z.string(),
    total: n,
    levels: nn,
    members: z.array(z.tuple([n, n, n])),
    member_count: n,
  })),
  /** members: [player_id, kills]. */
  bosses: z.array(z.object({
    metric: z.string(),
    total: n,
    members: z.array(z.tuple([n, n])),
    member_count: n,
  })),
  /** Loot by NPC from the rollup; members: [player_id, loot, drops]. */
  sources: z.array(z.object({
    npc_id: z.number().int(),
    name: z.string(),
    loot: n,
    drops: n,
    members: z.array(z.tuple([n, n, n])),
    member_count: n,
  })),
  /** receivers: [player_id, loot, quantity], top 8 by value. */
  items: z.array(z.object({
    item_id: z.number().int(),
    name: z.string(),
    quantity: n,
    loot: n,
    drops: n,
    receivers: z.array(z.tuple([n, n, n])),
    receiver_count: n,
  })),
  /** player_id -> [[item_id, quantity, loot], ...] top items per member. */
  member_items: z.record(z.string(), z.array(z.tuple([n, n, n]))),
  /** item_id -> name for everything in member_items. */
  item_names: z.record(z.string(), z.string().nullable()).default({}),
  big_drops: z.array(z.object({
    drop_id: z.number().int(),
    player_id: z.number().int(),
    item_id: z.number().int().nullable(),
    name: z.string().nullable(),
    npc_id: z.number().int().nullable(),
    source: z.string().nullable(),
    value: n,
    quantity: n,
    date: z.string().nullable(),
    image_url: z.string().nullable(),
  })),
  feeds: z.object({
    pets: z.array(z.object({ ...FeedBase, item_id: z.number().int().nullable().optional(), name: z.string().nullable().optional() })).default([]),
    clog: z.array(z.object({ ...FeedBase, item_id: z.number().int().nullable().optional(), name: z.string().nullable().optional(), source: z.string().nullable().optional(), slots: z.number().nullable().optional() })).default([]),
    pbs: z.array(z.object({ ...FeedBase, npc_id: z.number().int().nullable().optional(), name: z.string().nullable().optional(), time_ms: z.number().nullable().optional(), team_size: z.string().nullable().optional(), precise: z.boolean().nullable().optional() })).default([]),
    cas: z.array(z.object({ ...FeedBase, name: z.string().nullable().optional() })).default([]),
    quests: z.array(z.object({ ...FeedBase, name: z.string().nullable().optional(), quest_points: z.number().nullable().optional() })).default([]),
    diaries: z.array(z.object({ ...FeedBase, name: z.string().nullable().optional(), tier: z.string().nullable().optional() })).default([]),
    deaths: z.array(z.object({ ...FeedBase, killer: z.string().nullable().optional(), location: z.string().nullable().optional(), pvp: z.boolean().nullable().optional(), value_lost: z.number().nullable().optional() })).default([]),
    slayer: z.array(z.object({ ...FeedBase, name: z.string().nullable().optional(), amount: z.number().nullable().optional(), master: z.string().nullable().optional(), points: z.number().nullable().optional() })).default([]),
    pvp: z.array(z.object({ ...FeedBase, victim: z.string().nullable().optional(), value: z.number().nullable().optional(), location: z.string().nullable().optional(), wilderness: z.number().nullable().optional() })).default([]),
  }).default({ pets: [], clog: [], pbs: [], cas: [], quests: [], diaries: [], deaths: [], slayer: [], pvp: [] }),
  activity: z.object({ by_hour: z.array(n), by_weekday: z.array(n) }).nullable(),
});
export type GroupStats = z.infer<typeof GroupStatsSchema>;
export type GroupStatsFeedKey = keyof GroupStats["feeds"];
