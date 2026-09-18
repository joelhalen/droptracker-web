import { PlatformSummarySchema, type PlatformSummary } from "@droptracker/api-types";
import { apiGet, withFallback } from "./_client";
import { mockPlatformSummary } from "../mock-data";

export const platformApi = {

  // --- Platform-wide figures (the homepage's counter, account count, bosses) --
  /**
   * Month total, tracked accounts and the month's richest bosses.
   *
   * Use this rather than `group(2)` for anything platform-wide. The global
   * group's profile walks ~27k members per uncached request (seconds); this reads
   * the total the global lootboard already publishes plus a snapshot the backend
   * keeps in Redis, so it answers in milliseconds and survives backend restarts
   * warm.
   */
  async platformSummary(): Promise<PlatformSummary> {
    return withFallback(
      async () => PlatformSummarySchema.parse(await apiGet(`/platform/summary`, { revalidate: 30 })),
      () => mockPlatformSummary(),
    );
  },
};
