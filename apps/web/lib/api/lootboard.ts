import { apiGet, apiSend, withFallback, ApiError } from "./_client";
import { LootboardStyleListSchema, type LootboardStyleList } from "./types";
import {
  LootboardImageSchema,
  LootboardSchema,
  type Lootboard,
  type LootboardImage,
} from "@droptracker/api-types";
import {
  mockLootboard,
} from "../mock-data";

export const lootboardApi = {

  async lootboard(groupId: number, period = "all"): Promise<Lootboard> {
    return withFallback(
      async () =>
        LootboardSchema.parse(
          await apiGet(`/groups/${groupId}/lootboard?period=${encodeURIComponent(period)}`, {
            revalidate: 30,
          }),
        ),
      () => mockLootboard(groupId, period),
    );
  },


  /** Trigger the legacy image generator (share affordance, FRONTEND_PLAN.md §12). */
  async generateLootboardImage(groupId: number, period = "all"): Promise<LootboardImage> {
    return withFallback(
      async () =>
        LootboardImageSchema.parse(
          await apiSend("POST", `/groups/${groupId}/lootboard/generate`, { period }),
        ),
      () => ({ url: null }),
    );
  },


  /** Generate a custom-timeframe lootboard PNG (group-admin only). Errors
   * (invalid range, month still backfilling, cooldown) surface as ApiError
   * with a user-presentable message — deliberately no mock fallback. */
  async generateTimeframeBoard(
    groupId: number,
    startDate: string,
    endDate: string,
  ): Promise<{ url: string; start_date: string; end_date: string; source: string }> {
    const data = (await apiSend("POST", `/groups/${groupId}/lootboard/timeframe`, {
      start_date: startDate,
      end_date: endDate,
    })) as { url?: unknown; start_date?: unknown; end_date?: unknown; source?: unknown };
    if (!data || typeof data.url !== "string") {
      throw new ApiError(500, "Board generation returned no image URL.");
    }
    return {
      url: data.url,
      start_date: String(data.start_date ?? startDate),
      end_date: String(data.end_date ?? endDate),
      source: String(data.source ?? ""),
    };
  },


  /** Lootboard style catalog (id, category, preview) for the board-style picker. */
  async lootboardStyles(): Promise<LootboardStyleList> {
    return withFallback(
      async () => LootboardStyleListSchema.parse(await apiGet(`/lootboard-styles`)),
      () => ({
        styles: [
          { id: 1, name: "Classic Bank", category: "Classic", description: "The original dark bank layout.", preview_url: "https://www.droptracker.io/img/lootboards/1.png" },
          { id: 2, name: "Clean Light", category: "Classic", description: "Light parchment variant.", preview_url: "https://www.droptracker.io/img/lootboards/2.png" },
          { id: 3, name: "RuneLite Dark", category: "RuneLite", description: "Matches the RuneLite client theme.", preview_url: "https://www.droptracker.io/img/lootboards/3.png" },
        ],
      }),
    );
  },
};
