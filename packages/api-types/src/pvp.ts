/**
 * PvP tracking: kills on other players, kept apart from drops (backend
 * `web_api/routes/pvp.py`, `data/submissions/pvp.py`, migration web136a).
 *
 * Standings come from the backend's `pvp:` Redis boards (loot taken, kills,
 * deaths to other players) per period: `month` | `week` | `day` | `all` or a
 * raw partition token. Kills in LMS and other PvP minigames, and kills of an
 * account the killer also owns, are stored but never counted. Each group also
 * decides whether clanmate kills count and caps kills of one victim per day.
 */
import { z } from "zod";

// Same shape as index.ts's MoneySchema; re-declared because index.ts
// re-exports this module (see group-bank.ts).
const PvpMoneySchema = z.object({
  value: z.number().int(),
  value_formatted: z.string(),
});

export const PVP_METRICS = ["loot", "kills", "deaths"] as const;
export type PvpMetric = (typeof PVP_METRICS)[number];

export const PVP_METRIC_LABELS: Record<PvpMetric, string> = {
  loot: "Loot taken",
  kills: "Kills",
  deaths: "Deaths",
};

export const PvpLeaderboardEntrySchema = z.object({
  rank: z.number().int(),
  id: z.number().int(),
  name: z.string(),
  loot: PvpMoneySchema,
  kills: z.number().int(),
  deaths: z.number().int(),
  /** Kills per death; null with no kills and no deaths. */
  kd: z.number().nullable(),
});
export type PvpLeaderboardEntry = z.infer<typeof PvpLeaderboardEntrySchema>;

export const PvpLeaderboardSchema = z.object({
  period: z.string(),
  scope: z.string(),
  metric: z.enum(PVP_METRICS),
  entries: z.array(PvpLeaderboardEntrySchema),
  meta: z.object({ page: z.number().int(), limit: z.number().int(), total: z.number().int() }),
});
export type PvpLeaderboard = z.infer<typeof PvpLeaderboardSchema>;

export const PvpKillItemSchema = z.object({
  item_id: z.number().int(),
  name: z.string().nullable(),
  quantity: z.number().int(),
  value: PvpMoneySchema,
  icon_url: z.string(),
});
export type PvpKillItem = z.infer<typeof PvpKillItemSchema>;

export const PvpKillSchema = z.object({
  id: z.number().int(),
  player: z.object({ id: z.number().int(), name: z.string() }),
  victim: z.object({
    name: z.string(),
    /** Set when the victim is a tracked, visible player. */
    id: z.number().int().nullable(),
    combat_level: z.number().int().nullable(),
  }),
  value: PvpMoneySchema,
  item_count: z.number().int(),
  items: z.array(PvpKillItemSchema),
  world: z.number().int().nullable(),
  wilderness_level: z.number().int().nullable(),
  location: z.string().nullable(),
  image_url: z.string().nullable(),
  /** Unix seconds. */
  date: z.number().int().nullable(),
});
export type PvpKill = z.infer<typeof PvpKillSchema>;

export const PvpRecentSchema = z.object({ kills: z.array(PvpKillSchema) });
export type PvpRecent = z.infer<typeof PvpRecentSchema>;

const PvpRankRowSchema = z.object({
  rank: z.number().int(),
  id: z.number().int(),
  name: z.string(),
});

export const GroupPvpSchema = z.object({
  group: z.object({ id: z.number().int(), name: z.string() }),
  period: z.string(),
  totals: z.object({
    loot: PvpMoneySchema,
    kills: z.number().int(),
    /** Members with at least one counted kill this period. */
    players: z.number().int(),
  }),
  top_loot: z.array(PvpRankRowSchema.extend({ loot: PvpMoneySchema })),
  top_kills: z.array(PvpRankRowSchema.extend({ kills: z.number().int() })),
  recent: z.array(PvpKillSchema),
  /** The group's PvP lootboard image, once it has been drawn. */
  board: z.object({ url: z.string(), updated_at: z.number().int() }).nullable(),
});
export type GroupPvp = z.infer<typeof GroupPvpSchema>;

const PvpStatLineSchema = z.object({
  loot: PvpMoneySchema,
  kills: z.number().int(),
  deaths: z.number().int(),
  kd: z.number().nullable(),
  rank: z.number().int().nullable(),
});
export type PvpStatLine = z.infer<typeof PvpStatLineSchema>;

export const PlayerPvpSchema = z.object({
  player: z.object({ id: z.number().int(), name: z.string() }),
  period: z.string(),
  stats: PvpStatLineSchema,
  all_time: PvpStatLineSchema,
  recent_kills: z.array(PvpKillSchema),
  recent_deaths: z.array(
    z.object({
      id: z.number().int(),
      killer: z.string().nullable(),
      location: z.string().nullable(),
      value_lost: PvpMoneySchema.nullable(),
      /** Unix seconds. */
      date: z.number().int().nullable(),
    }),
  ),
});
export type PlayerPvp = z.infer<typeof PlayerPvpSchema>;
