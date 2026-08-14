import { apiGet, apiSend, withFallback, hasSessionCookie, ApiError } from "./_client";
import { env } from "../env";
import {
  AccountSettingsSchema,
  MyNitroBoostSchema,
  NotificationPrefsSchema,
  ClaimPreviewSchema,
  ClaimResultSchema,
  MeSchema,
  type ClaimPreview,
  type ClaimResult,
  type AccountSettings,
  type AccountSettingsPatch,
  type MyNitroBoost,
  type NotificationPrefs,
  type Me,
} from "@droptracker/api-types";
import {
  mockAccountSettings,
  mockMe,
  mockClaimPreview,
  mockClaimResult,
} from "../mock-data";

export const accountApi = {

  async me(): Promise<Me | null> {
    try {
      return MeSchema.parse(await apiGet(`/me`, { authed: true }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      // In mock mode, treat any present session cookie (incl. the dev mock
      // login) as an authenticated mock user so the dashboard is demonstrable.
      if (env.useMockApi) return (await hasSessionCookie()) ? mockMe() : null;
      throw err;
    }
  },


  async settings(): Promise<AccountSettings> {
    return withFallback(
      async () => AccountSettingsSchema.parse(await apiGet(`/me/settings`, { authed: true })),
      () => mockAccountSettings(),
    );
  },


  async updateSettings(patch: AccountSettingsPatch): Promise<AccountSettings> {
    return withFallback(
      async () => AccountSettingsSchema.parse(await apiSend("PATCH", `/me`, patch)),
      () => ({ ...mockAccountSettings(), ...patch }),
    );
  },


  /** Which of the user's groups a Nitro boost on the DropTracker Discord
   * supports, plus the eligible groups and per-boost credit. */
  async myNitroBoost(): Promise<MyNitroBoost> {
    return withFallback(
      async () => MyNitroBoostSchema.parse(await apiGet(`/me/nitro-boost`, { authed: true })),
      () => ({
        per_boost_cents: 500,
        boost_slots: 1,
        designated_group_id: null,
        effective_group_id: null,
        groups: [],
      }),
    );
  },


  /** Choose which group your Discord boost supports (null = auto-pick). */
  async setMyNitroBoost(groupId: number | null): Promise<MyNitroBoost> {
    return withFallback(
      async () =>
        MyNitroBoostSchema.parse(await apiSend("POST", `/me/nitro-boost`, { group_id: groupId })),
      () => ({
        per_boost_cents: 500,
        boost_slots: 1,
        designated_group_id: groupId,
        effective_group_id: groupId,
        groups: [],
      }),
    );
  },


  /** Toggle one linked account's public visibility (players.hidden). */
  async setMyPlayerHidden(playerId: number, hidden: boolean): Promise<AccountSettings> {
    return withFallback(
      async () =>
        AccountSettingsSchema.parse(await apiSend("PATCH", `/me/players/${playerId}`, { hidden })),
      () => {
        const mock = mockAccountSettings();
        return {
          ...mock,
          players: mock.players.map((p) => (p.id === playerId ? { ...p, hidden } : p)),
        };
      },
    );
  },


  /** In-game event notification prefs for every linked account (types are
   * server-driven — new notification types appear without a UI change). */
  async notificationPrefs(): Promise<NotificationPrefs> {
    return withFallback(
      async () =>
        NotificationPrefsSchema.parse(await apiGet(`/me/notification-prefs`, { authed: true })),
      () => ({ types: [], players: [] }),
    );
  },


  /** Replace one linked account's in-game notification prefs. */
  async setPlayerNotificationPrefs(
    playerId: number,
    prefs: Record<string, boolean>,
  ): Promise<NotificationPrefs> {
    return withFallback(
      async () =>
        NotificationPrefsSchema.parse(
          await apiSend("PUT", `/me/players/${playerId}/notification-prefs`, { prefs }),
        ),
      () => ({ types: [], players: [] }),
    );
  },


  // --- RSN claim flow ----------------------------------------------------
  async claimPreview(rsn: string, guildId?: string): Promise<ClaimPreview> {
    const q = new URLSearchParams({ rsn });
    if (guildId) q.set("guild_id", guildId);
    return withFallback(
      async () =>
        ClaimPreviewSchema.parse(
          await apiGet(`/me/players/claim-preview?${q.toString()}`, { authed: true }),
        ),
      () => mockClaimPreview(rsn),
    );
  },


  async claimPlayer(input: { rsn: string; guild_id?: string }): Promise<ClaimResult> {
    return withFallback(
      async () => ClaimResultSchema.parse(await apiSend("POST", `/me/players/claim`, input)),
      () => mockClaimResult(input.rsn),
    );
  },


  async unclaimPlayer(playerId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/me/players/${playerId}/claim`, undefined);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },
};
