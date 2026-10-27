import { z } from "zod";
import { apiGet, apiSend } from "./_client";
import { RankRolesSchema, type RankRoleConfig, type RankRoles } from "@droptracker/api-types";

/**
 * Clan rank roles: in-game ranks mapped to Discord roles, applied by the core
 * bot. Saving only stores the map and asks the bot for a pass.
 * Backend: web_api/routes/rank_roles.py.
 */
export const rankRolesApi = {
  async groupRankRoles(groupId: number): Promise<RankRoles> {
    return RankRolesSchema.parse(await apiGet(`/groups/${groupId}/rank-roles`, { authed: true }));
  },

  /** Save, or with `dryRun` only preview who would get which role. */
  async saveGroupRankRoles(
    groupId: number,
    config: RankRoleConfig,
    dryRun = false,
  ): Promise<RankRoles> {
    const query = dryRun ? "?dry_run=1" : "";
    return RankRolesSchema.parse(
      await apiSend("PUT", `/groups/${groupId}/rank-roles${query}`, config),
    );
  },

  /** "Sync now": a full pass that also applies removals the bot held back. */
  async syncGroupRankRoles(groupId: number): Promise<{ ok: boolean }> {
    return z
      .object({ ok: z.boolean() })
      .parse(await apiSend("POST", `/groups/${groupId}/rank-roles/sync`, {}));
  },
};
