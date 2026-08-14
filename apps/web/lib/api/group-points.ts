import { z } from "zod";
import { apiGet, apiSend } from "./_client";
import {
  type PointBoost,
  PointBoostSchema,
  type PointListEntry,
  PointListEntrySchema,
  type PointMod,
  PointModSchema,
  type PointSeason,
  PointSeasonSchema,
  type PointsAdjustResult,
  PointsAdjustResultSchema,
  type PointsBehavior,
  PointsBehaviorSchema,
  type PointsHistoryPage,
  PointsHistoryPageSchema,
  type PointsLeaderboard,
  PointsLeaderboardSchema,
  type PointsSettings,
  PointsSettingsSchema,
  type PointRule,
  PointRuleSchema,
} from "@droptracker/api-types";

export const groupPointsApi = {

  // --- Custom points system ----------------------------------------------
  async groupPointsSettings(groupId: number): Promise<PointsSettings> {
    return PointsSettingsSchema.parse(
      await apiGet(`/groups/${groupId}/points/settings`, { authed: true }),
    );
  },


  async updateGroupPointsSettings(
    groupId: number,
    patch: { rules?: Partial<PointRule>[]; behavior?: Partial<PointsBehavior> },
  ): Promise<{ rules: PointRule[]; behavior: PointsBehavior }> {
    return z
      .object({ rules: z.array(PointRuleSchema), behavior: PointsBehaviorSchema })
      .parse(await apiSend("PUT", `/groups/${groupId}/points/settings`, patch));
  },


  async groupPointMods(groupId: number): Promise<PointMod[]> {
    const data = z
      .object({ mods: z.array(PointModSchema) })
      .parse(await apiGet(`/groups/${groupId}/points/mods`, { authed: true }));
    return data.mods;
  },


  async createGroupPointMod(groupId: number, body: unknown): Promise<PointMod[]> {
    const data = z
      .object({ mods: z.array(PointModSchema) })
      .parse(await apiSend("POST", `/groups/${groupId}/points/mods`, body));
    return data.mods;
  },


  async updateGroupPointMod(groupId: number, modId: number, body: unknown): Promise<PointMod[]> {
    const data = z
      .object({ mods: z.array(PointModSchema) })
      .parse(await apiSend("PATCH", `/groups/${groupId}/points/mods/${modId}`, body));
    return data.mods;
  },


  async deleteGroupPointMod(groupId: number, modId: number): Promise<PointMod[]> {
    const data = z
      .object({ mods: z.array(PointModSchema) })
      .parse(await apiSend("DELETE", `/groups/${groupId}/points/mods/${modId}`, {}));
    return data.mods;
  },


  async groupPointLists(groupId: number): Promise<PointListEntry[]> {
    const data = z
      .object({ entries: z.array(PointListEntrySchema) })
      .parse(await apiGet(`/groups/${groupId}/points/lists`, { authed: true }));
    return data.entries;
  },


  async createGroupPointListEntry(groupId: number, body: unknown): Promise<PointListEntry[]> {
    const data = z
      .object({ entries: z.array(PointListEntrySchema) })
      .parse(await apiSend("POST", `/groups/${groupId}/points/lists`, body));
    return data.entries;
  },


  async deleteGroupPointListEntry(groupId: number, entryId: number): Promise<PointListEntry[]> {
    const data = z
      .object({ entries: z.array(PointListEntrySchema) })
      .parse(await apiSend("DELETE", `/groups/${groupId}/points/lists/${entryId}`, {}));
    return data.entries;
  },


  async groupPointBoosts(groupId: number): Promise<PointBoost[]> {
    const data = z
      .object({ boosts: z.array(PointBoostSchema) })
      .parse(await apiGet(`/groups/${groupId}/points/boosts`, { authed: true }));
    return data.boosts;
  },


  async createGroupPointBoost(groupId: number, body: unknown): Promise<PointBoost[]> {
    const data = z
      .object({ boosts: z.array(PointBoostSchema) })
      .parse(await apiSend("POST", `/groups/${groupId}/points/boosts`, body));
    return data.boosts;
  },


  async updateGroupPointBoost(
    groupId: number,
    boostId: number,
    body: unknown,
  ): Promise<PointBoost[]> {
    const data = z
      .object({ boosts: z.array(PointBoostSchema) })
      .parse(await apiSend("PATCH", `/groups/${groupId}/points/boosts/${boostId}`, body));
    return data.boosts;
  },


  async deleteGroupPointBoost(groupId: number, boostId: number): Promise<PointBoost[]> {
    const data = z
      .object({ boosts: z.array(PointBoostSchema) })
      .parse(await apiSend("DELETE", `/groups/${groupId}/points/boosts/${boostId}`, {}));
    return data.boosts;
  },


  async createGroupPointSeason(
    groupId: number,
    body: { name: string; start_at: string; end_at: string },
  ): Promise<PointSeason> {
    const data = z
      .object({ season: PointSeasonSchema })
      .parse(await apiSend("POST", `/groups/${groupId}/points/seasons`, body));
    return data.season;
  },


  async updateGroupPointSeason(
    groupId: number,
    seasonId: number,
    body: Partial<{ name: string; start_at: string; end_at: string }>,
  ): Promise<PointSeason> {
    const data = z
      .object({ season: PointSeasonSchema })
      .parse(await apiSend("PATCH", `/groups/${groupId}/points/seasons/${seasonId}`, body));
    return data.season;
  },


  async deleteGroupPointSeason(groupId: number, seasonId: number): Promise<void> {
    await apiSend("DELETE", `/groups/${groupId}/points/seasons/${seasonId}`, {});
  },


  async adjustGroupPoints(
    groupId: number,
    body: { player_id: number; amount: number; reason: string },
  ): Promise<PointsAdjustResult> {
    return PointsAdjustResultSchema.parse(
      await apiSend("POST", `/groups/${groupId}/points/adjust`, body),
    );
  },


  async groupPointsHistory(
    groupId: number,
    params: { player_id?: number; manual?: boolean; page?: number; limit?: number } = {},
  ): Promise<PointsHistoryPage> {
    const q = new URLSearchParams();
    if (params.player_id) q.set("player_id", String(params.player_id));
    if (params.manual) q.set("manual", "1");
    if (params.page) q.set("page", String(params.page));
    if (params.limit) q.set("limit", String(params.limit));
    return PointsHistoryPageSchema.parse(
      await apiGet(`/groups/${groupId}/points/history?${q}`, { authed: true }),
    );
  },


  async resetGroupPoints(groupId: number): Promise<{ deleted: number }> {
    return z
      .object({ deleted: z.number().int() })
      .parse(await apiSend("POST", `/groups/${groupId}/points/reset`, { confirm: "RESET" }));
  },


  /** Public points leaderboard (authed pass-through so members can view
   * private boards). */
  async groupPointsLeaderboard(
    groupId: number,
    params: { period?: string; page?: number; limit?: number } = {},
  ): Promise<PointsLeaderboard> {
    const q = new URLSearchParams();
    if (params.period) q.set("period", params.period);
    if (params.page) q.set("page", String(params.page));
    if (params.limit) q.set("limit", String(params.limit));
    return PointsLeaderboardSchema.parse(
      await apiGet(`/groups/${groupId}/points/leaderboard?${q}`, { authed: true }),
    );
  },
};
