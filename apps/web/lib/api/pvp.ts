import { apiGet, withFallback } from "./_client";
import {
  GroupPvpSchema,
  PlayerPvpSchema,
  PvpLeaderboardSchema,
  PvpRecentSchema,
  type GroupPvp,
  type PlayerPvp,
  type PvpLeaderboard,
  type PvpMetric,
  type PvpRecent,
} from "@droptracker/api-types";

const ZERO = { value: 0, value_formatted: "0" };
const EMPTY_LINE = { loot: ZERO, kills: 0, deaths: 0, kd: null, rank: null };

/** `global` or `group:{id}`, the scope grammar of the drop leaderboards. */
export type PvpScope = "global" | `group:${number}`;

export const pvpApi = {
  // --- PvP tracking (web136a) ----------------------------------------------
  /** One page of a PvP board: loot taken, kills or deaths, global or one group.
   * `period` is a sentinel (`month`, `week`, `day`, `all`) or a raw token; the
   * backend resolves sentinels so the week maths never drifts. */
  async pvpLeaderboard(opts: {
    period?: string;
    scope?: PvpScope;
    metric?: PvpMetric;
    page?: number;
    limit?: number;
  } = {}): Promise<PvpLeaderboard> {
    const q = new URLSearchParams({
      period: opts.period ?? "month",
      scope: opts.scope ?? "global",
      metric: opts.metric ?? "loot",
      page: String(opts.page ?? 1),
      limit: String(opts.limit ?? 50),
    });
    return withFallback(
      async () => PvpLeaderboardSchema.parse(await apiGet(`/pvp/leaderboard?${q}`)),
      () =>
        PvpLeaderboardSchema.parse({
          period: opts.period ?? "month",
          scope: opts.scope ?? "global",
          metric: opts.metric ?? "loot",
          entries: [],
          meta: { page: opts.page ?? 1, limit: opts.limit ?? 50, total: 0 },
        }),
    );
  },

  /** The latest counted kills, site-wide or for one group. */
  async pvpRecent(opts: { scope?: PvpScope; limit?: number } = {}): Promise<PvpRecent> {
    const q = new URLSearchParams({
      scope: opts.scope ?? "global",
      limit: String(opts.limit ?? 20),
    });
    return withFallback(
      async () => PvpRecentSchema.parse(await apiGet(`/pvp/recent?${q}`)),
      () => PvpRecentSchema.parse({ kills: [] }),
    );
  },

  /** A group's PvP page: totals, top killers, recent kills and its board. */
  async groupPvp(groupId: number, period = "month"): Promise<GroupPvp> {
    return withFallback(
      async () =>
        GroupPvpSchema.parse(
          await apiGet(`/groups/${groupId}/pvp?period=${encodeURIComponent(period)}`),
        ),
      () =>
        GroupPvpSchema.parse({
          group: { id: groupId, name: "Group" },
          period,
          totals: { loot: ZERO, kills: 0, players: 0 },
          top_loot: [],
          top_kills: [],
          recent: [],
          board: null,
        }),
    );
  },

  /** A player's PvP record: this period, all time, recent kills and deaths. */
  async playerPvp(playerId: number, period = "month"): Promise<PlayerPvp> {
    return withFallback(
      async () =>
        PlayerPvpSchema.parse(
          await apiGet(`/players/${playerId}/pvp?period=${encodeURIComponent(period)}`),
        ),
      () =>
        PlayerPvpSchema.parse({
          player: { id: playerId, name: "Player" },
          period,
          stats: EMPTY_LINE,
          all_time: EMPTY_LINE,
          recent_kills: [],
          recent_deaths: [],
        }),
    );
  },
};
