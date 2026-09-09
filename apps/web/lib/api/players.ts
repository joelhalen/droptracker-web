import { apiGet, withFallback } from "./_client";
import {
  PersonalBestLoadoutSchema,
  PlayerAchievementsSchema,
  PlayerCollectionLogSchema,
  PlayerLootTrackerSchema,
  PlayerProfileSchema,
  type LootPeriod,
  type PersonalBestLoadout,
  type PlayerAchievements,
  type PlayerCollectionLog,
  type PlayerLootTracker,
  type PlayerProfile,
} from "@droptracker/api-types";
import {
  mockPersonalBestLoadout,
  mockPlayerLoot,
  mockPlayerProfile,
} from "../mock-data";

export const playersApi = {

  async player(id: number): Promise<PlayerProfile> {
    return withFallback(
      async () => PlayerProfileSchema.parse(await apiGet(`/players/${id}`, { revalidate: 30 })),
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
