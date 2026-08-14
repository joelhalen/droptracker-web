import { apiGet, withFallback } from "./_client";
import {
  PlayerLootTrackerSchema,
  PlayerProfileSchema,
  type LootPeriod,
  type PlayerLootTracker,
  type PlayerProfile,
} from "@droptracker/api-types";
import {
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
};
