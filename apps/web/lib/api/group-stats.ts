import { apiGet, apiSend, withFallback } from "./_client";
import {
  GroupStatsSchema,
  RecapDesignAdminSchema,
  RecapDesignResponseSchema,
  defaultRecapDesign,
  type GroupStats,
  type RecapDesign,
  type RecapDesignAdmin,
  type RecapDesignResponse,
} from "@droptracker/api-types";

/** Clan stats + recap designs (web154a, suggestion #224). */
export const groupStatsApi = {
  /**
   * A clan's stats for `period` ("YYYY-MM", "YYYY" or "all"; omitted = this
   * month). The backend caches the payload (10 min for a month in progress, a
   * day once closed), so the BFF only keeps it for a minute. null = unknown
   * group or a period we don't serve.
   */
  async groupStats(groupId: number, period?: string): Promise<GroupStats | null> {
    const q = period ? `?period=${encodeURIComponent(period)}` : "";
    return withFallback(
      async () => GroupStatsSchema.parse(await apiGet(`/groups/${groupId}/stats${q}`, { revalidate: 60 })),
      () => null,
    ).catch(() => null);
  },

  /**
   * The effective design for a clan's card. Never fails: the built-in default
   * IS the card as it always was, so a backend hiccup draws that rather than
   * nothing. `fresh` for the screenshot route, whose PNG gets posted.
   */
  async recapDesign(groupId: number, period: string, fresh = false): Promise<RecapDesignResponse> {
    const fallback = (): RecapDesignResponse => ({ design: defaultRecapDesign(), source: "builtin", updated_at: null });
    return withFallback(
      async () =>
        RecapDesignResponseSchema.parse(
          await apiGet(`/groups/${groupId}/recap-design?period=${encodeURIComponent(period)}`, {
            revalidate: fresh ? 0 : 30,
          }),
        ),
      fallback,
    ).catch(fallback);
  },

  /** Designer state (admins only). `period` "" = the clan default. */
  async recapDesignAdmin(groupId: number, period: string): Promise<RecapDesignAdmin> {
    return RecapDesignAdminSchema.parse(
      await apiGet(`/groups/${groupId}/recap-design/admin?period=${encodeURIComponent(period)}`, {
        authed: true,
        revalidate: 0,
      }),
    );
  },

  async saveRecapDesign(groupId: number, period: string, design: RecapDesign): Promise<RecapDesignResponse> {
    return RecapDesignResponseSchema.parse(
      await apiSend("PUT", `/groups/${groupId}/recap-design`, { period, design }),
    );
  },

  async resetRecapDesign(groupId: number, period: string): Promise<RecapDesignResponse> {
    return RecapDesignResponseSchema.parse(
      await apiSend("DELETE", `/groups/${groupId}/recap-design?period=${encodeURIComponent(period)}`, {}),
    );
  },

  async approveRecap(groupId: number, period: string, approved: boolean): Promise<void> {
    await apiSend("POST", `/groups/${groupId}/recaps/${period}/approve`, { approved });
  },

  /** Ask the bot to re-render the card and edit the Discord post. */
  async refreshRecapPost(groupId: number, period: string): Promise<void> {
    await apiSend("POST", `/groups/${groupId}/recaps/${period}/refresh-post`, {});
  },

  /** Rebuild a finished month's card from current data (adds standouts). */
  async regenerateRecap(groupId: number, period: string): Promise<void> {
    await apiSend("POST", `/groups/${groupId}/recaps/${period}/regenerate`, {});
  },
};
