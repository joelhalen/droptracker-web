import { ApiError, apiGet, withFallback } from "./_client";
import {
  PersonalBestLoadoutSchema,
  PlayerAchievementsSchema,
  PlayerCollectionLogSchema,
  PlayerDiariesSchema,
  PlayerLootTrackerSchema,
  PlayerOverviewSchema,
  PlayerProfileSchema,
  PlayerWomGainsSchema,
  type LootPeriod,
  type OverviewPeriod,
  type PersonalBestLoadout,
  type PlayerAchievements,
  type PlayerCollectionLog,
  type PlayerDiaries,
  type PlayerLootTracker,
  type PlayerOverview,
  type PlayerProfile,
  type PlayerWomGains,
} from "@droptracker/api-types";
import {
  mockPersonalBestLoadout,
  mockPlayerLoot,
  mockPlayerProfile,
} from "../mock-data";

/** Cache tag on a player's profile + visibility reads. */
export function playerCacheTag(id: number): string {
  return `player:${id}`;
}

export const playersApi = {

  /** Public profile; 404s (ApiError) for a missing or hidden account.
   *
   * The profile route 404s a hidden account, but the fetch cache only stores
   * 200s, so a revalidation's 404 is dropped and the pre-hide profile would be
   * served by id indefinitely (ticket #515). The visibility check always
   * answers 200, so hiding reaches every page that loads a player through
   * here. Both are tagged `player:{id}` for the settings actions to flush. */
  async player(id: number): Promise<PlayerProfile> {
    return withFallback(
      async () => {
        const tags = [playerCacheTag(id)];
        const [visibility, profile] = await Promise.all([
          apiGet(`/players/${id}/visibility`, { revalidate: 30, tags }),
          apiGet(`/players/${id}`, { revalidate: 30, tags }),
        ]);
        if (!(visibility as { visible?: unknown })?.visible) {
          throw new ApiError(404, `Web API 404 for /players/${id}`);
        }
        return PlayerProfileSchema.parse(profile);
      },
      () => mockPlayerProfile(id),
    );
  },


  /** RuneLite-style loot tracker: drops grouped by NPC, for one month or —
   * with `partition: "all"` — the player's whole account. All-time is a much
   * heavier read on the backend, so it gets a longer ISR window. */
  async playerLoot(id: number, partition?: LootPeriod): Promise<PlayerLootTracker> {
    const allTime = partition === "all";
    const qs = partition ? `?partition=${partition}` : "";
    return withFallback(
      async () =>
        PlayerLootTrackerSchema.parse(
          await apiGet(`/players/${id}/loot${qs}`, { revalidate: allTime ? 300 : 60 }),
        ),
      () => mockPlayerLoot(id, partition),
    );
  },

  // --- Account state, as reported by the plugin --------------------------
  /** Every collection log slot we know a player has filled.
   *
   * Note `slots` (what the game reports) can exceed `items_known` (what we can
   * show): until the player opens their collection log once, we only know about
   * items that dropped while the plugin was running. */
  async playerCollectionLog(id: number): Promise<PlayerCollectionLog> {
    return PlayerCollectionLogSchema.parse(
      await apiGet(`/players/${id}/collection-log`, { revalidate: 60 }),
    );
  },

  /** Combat achievements, quests and achievement diaries in one payload. */
  async playerAchievements(id: number): Promise<PlayerAchievements> {
    return PlayerAchievementsSchema.parse(
      await apiGet(`/players/${id}/achievements`, { revalidate: 60 }),
    );
  },

  /** Skill levels, gains over the last day/week/month and the recent
   * achievements feed. All from our own tracking. */
  async playerOverview(id: number): Promise<PlayerOverview> {
    return PlayerOverviewSchema.parse(
      await apiGet(`/players/${id}/overview`, { revalidate: 60 }),
    );
  },

  /** Every achievement diary task with what is known about each. */
  async playerDiaries(id: number): Promise<PlayerDiaries> {
    return PlayerDiariesSchema.parse(
      await apiGet(`/players/${id}/diaries`, { revalidate: 300 }),
    );
  },

  /** Wise Old Man's gains for a period. `enabled: false` when the backend
   * has the lookup switched off. */
  async playerWomGains(id: number, period: OverviewPeriod): Promise<PlayerWomGains> {
    return PlayerWomGainsSchema.parse(
      await apiGet(`/players/${id}/wom-gains?period=${period}`, { revalidate: 600 }),
    );
  },

  /** Gear, inventory and character model a personal best was set with, when captured. */
  async personalBestLoadout(pbId: number): Promise<PersonalBestLoadout> {
    return withFallback(
      async () =>
        PersonalBestLoadoutSchema.parse(
          await apiGet(`/personal-bests/${pbId}/loadout`, { revalidate: 300 }),
        ),
      () => mockPersonalBestLoadout(pbId),
    );
  },
};
