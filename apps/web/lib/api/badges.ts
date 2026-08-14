import { apiGet, apiSend, withFallback } from "./_client";
import {
  AdminBadgeSchema,
  BadgeDefinitionSchema,
  PlayerBadgeSchema,
  type AdminBadge,
  type AdminBadgeInput,
  type BadgeDefinition,
  type PlayerBadge as PlayerBadgeAward,
} from "@droptracker/api-types";

export const badgesApi = {

  // --- Badges -------------------------------------------------------------
  async badges(): Promise<BadgeDefinition[]> {
    return withFallback(
      async () => BadgeDefinitionSchema.array().parse(await apiGet(`/badges`, { revalidate: 300 })),
      () => [],
    );
  },


  async playerBadges(playerId: number): Promise<PlayerBadgeAward[]> {
    return withFallback(
      async () =>
        PlayerBadgeSchema.array().parse(
          await apiGet(`/players/${playerId}/badges`, { revalidate: 0 }),
        ),
      () => [],
    );
  },


  async adminBadges(): Promise<AdminBadge[]> {
    return withFallback(
      async () => AdminBadgeSchema.array().parse(await apiGet(`/admin/badges`, { authed: true })),
      () => [],
    );
  },


  async adminSaveBadge(input: AdminBadgeInput): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/admin/badges`, input);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  async adminDeleteBadge(key: string): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/admin/badges/${encodeURIComponent(key)}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  async adminAwardBadge(
    playerId: number,
    badgeKey: string,
    note?: string,
  ): Promise<{ award_id: number }> {
    return withFallback(
      async () =>
        (await apiSend("POST", `/admin/players/${playerId}/badges`, {
          badge_key: badgeKey,
          note,
        })) as { award_id: number },
      () => ({ award_id: Math.floor(Math.random() * 100000) }),
    );
  },


  async adminRevokeBadge(playerId: number, awardId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/admin/players/${playerId}/badges/${awardId}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },
};
