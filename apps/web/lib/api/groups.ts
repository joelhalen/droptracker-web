import { z } from "zod";
import { apiGet, apiSend, apiSendForm, withFallback } from "./_client";
import { type DiscordChannelList, type PbBossList } from "./types";
import {
  GroupDiagnosticsSchema,
  GroupMembersPageSchema,
  GroupProfileSchema,
  BotInviteSchema,
  CreateGroupResultSchema,
  GuildStatusSchema,
  MyGuildsSchema,
  type BotInvite,
  type CreateGroupResult,
  type MyGuilds,
  WomGroupPreviewSchema,
  WomSyncResultSchema,
  type GroupDiscordRoles,
  GroupDiscordRolesSchema,
  type CreateGroupInput,
  type GroupConfigPatch,
  type GroupDiagnostics,
  type GroupMembersPage,
  type GroupProfile,
  type GuildStatus,
  type AuthorizedUsersResponse,
  AuthorizedUsersResponseSchema,
  type EventManagersResponse,
  EventManagersResponseSchema,
  type BlacklistEntryType,
  type NotificationBlacklist,
  NotificationBlacklistSchema,
  type WomGroupPreview,
  type WomSyncResult,
} from "@droptracker/api-types";
import {
  mockDiagnostics,
  mockGroupConfig,
  mockGroupMembers,
  mockGroupProfile,
  mockGuildStatus,
  mockAuthorizedUsers,
  mockEventManagers,
  mockNotificationBlacklist,
  mockBotInvite,
  mockManageableGuilds,
  mockWomLookup,
  mockWomSync,
} from "../mock-data";

export const groupsApi = {

  async group(id: number): Promise<GroupProfile> {
    return withFallback(
      async () => GroupProfileSchema.parse(await apiGet(`/groups/${id}`, { revalidate: 30 })),
      () => mockGroupProfile(id),
    );
  },


  /** Upload a group icon (multipart 'file'); returns the stored public URL. */
  async uploadGroupIcon(groupId: number, form: FormData): Promise<{ icon_url: string }> {
    return z
      .object({ icon_url: z.string() })
      .parse(await apiSendForm("POST", `/groups/${groupId}/icon`, form));
  },


  async deleteGroupIcon(groupId: number): Promise<void> {
    await apiSend("DELETE", `/groups/${groupId}/icon`, {});
  },


  async groupConfig(groupId: number): Promise<Record<string, string | number | boolean | null>> {
    return withFallback(
      async () =>
        (await apiGet(`/groups/${groupId}/config`, { authed: true })) as Record<
          string,
          string | number | boolean | null
        >,
      () => mockGroupConfig(),
    );
  },


  /** Text channels in the group's linked Discord guild, cached by the bot (never a live Discord call). */
  async groupDiscordChannels(groupId: number): Promise<DiscordChannelList> {
    return withFallback(
      async () =>
        (await apiGet(`/groups/${groupId}/discord-channels`, {
          authed: true,
        })) as DiscordChannelList,
      () => ({
        channels: [
          { id: "111111111111111111", name: "drops", position: 0, type: "text" as const },
          { id: "222222222222222222", name: "lootboard", position: 1, type: "text" as const },
          { id: "333333333333333333", name: "announcements", position: 2, type: "text" as const },
          { id: "666666666666666666", name: "achievements", position: 3, type: "forum" as const },
          {
            id: "777777777777777777",
            name: "drops",
            position: 3,
            type: "thread" as const,
            parent_id: "666666666666666666",
          },
          {
            id: "888888888888888888",
            name: "personal-bests",
            position: 3,
            type: "thread" as const,
            parent_id: "666666666666666666",
          },
        ],
        cached: true,
      }),
    );
  },


  /** Boss names that have PBs stored, for the Hall of Fame boss picker. */
  async groupPbBosses(groupId: number): Promise<PbBossList> {
    return withFallback(
      async () => (await apiGet(`/groups/${groupId}/pb-bosses`, { authed: true })) as PbBossList,
      () => ({
        bosses: ["Chambers Of Xeric", "Theatre Of Blood", "Tombs Of Amascut", "Vorkath", "Zulrah"],
        cached: true,
      }),
    );
  },


  async updateGroupConfig(groupId: number, patch: GroupConfigPatch): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("PATCH", `/groups/${groupId}/config`, patch);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  // --- Announcements (write) --------------------------------------------
  /** Roles of the group's linked guild (bot-cached; stale=true while warming). */
  async groupDiscordRoles(groupId: number): Promise<GroupDiscordRoles> {
    return withFallback(
      async () =>
        GroupDiscordRolesSchema.parse(
          await apiGet(`/groups/${groupId}/discord/roles`, { authed: true }),
        ),
      () => ({
        roles: [
          { id: "111111111111111111", name: "Clanmate", position: 2 },
          { id: "222222222222222222", name: "Events", position: 1 },
        ],
        stale: false,
      }),
    );
  },


  // --- Group admin -------------------------------------------------------
  async groupMembers(groupId: number, page = 1, q?: string): Promise<GroupMembersPage> {
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set("q", q);
    return withFallback(
      async () =>
        GroupMembersPageSchema.parse(
          await apiGet(`/groups/${groupId}/members?${params}`, { authed: true }),
        ),
      () => mockGroupMembers(groupId, page),
    );
  },


  // --- Authorized users (post-creation admin management) -----------------
  async groupAuthorizedUsers(groupId: number): Promise<AuthorizedUsersResponse> {
    return withFallback(
      async () =>
        AuthorizedUsersResponseSchema.parse(
          await apiGet(`/groups/${groupId}/authorized-users`, { authed: true }),
        ),
      () => mockAuthorizedUsers(),
    );
  },


  /** Add by Discord ID (snowflake) or DropTracker username. */
  async addGroupAuthorizedUser(
    groupId: number,
    identifier: string,
  ): Promise<AuthorizedUsersResponse> {
    return withFallback(
      async () =>
        AuthorizedUsersResponseSchema.parse(
          await apiSend("POST", `/groups/${groupId}/authorized-users`, { identifier }),
        ),
      () => mockAuthorizedUsers(),
    );
  },


  async removeGroupAuthorizedUser(
    groupId: number,
    target: { user_id?: number | null; discord_id?: string | null },
  ): Promise<AuthorizedUsersResponse> {
    return withFallback(
      async () =>
        AuthorizedUsersResponseSchema.parse(
          await apiSend("DELETE", `/groups/${groupId}/authorized-users`, target),
        ),
      () => mockAuthorizedUsers(),
    );
  },


  /** web86a: hand the group to one of its existing admins (owner-only). */
  async transferGroupOwnership(
    groupId: number,
    userId: number,
  ): Promise<AuthorizedUsersResponse> {
    return withFallback(
      async () =>
        AuthorizedUsersResponseSchema.parse(
          await apiSend("POST", `/groups/${groupId}/ownership/transfer`, {
            user_id: userId,
          }),
        ),
      () => mockAuthorizedUsers(),
    );
  },


  /** web86a: take the owner seat of a group that has none (any admin, once). */
  async claimGroupOwnership(groupId: number): Promise<AuthorizedUsersResponse> {
    return withFallback(
      async () =>
        AuthorizedUsersResponseSchema.parse(
          await apiSend("POST", `/groups/${groupId}/ownership/claim`, {}),
        ),
      () => mockAuthorizedUsers(),
    );
  },


  /** web86a: does Discord "Manage Server" still confer admin? (owner-only) */
  async setGroupAdminPolicy(
    groupId: number,
    discordPermsGrantAdmin: boolean,
  ): Promise<AuthorizedUsersResponse> {
    return withFallback(
      async () =>
        AuthorizedUsersResponseSchema.parse(
          await apiSend("PATCH", `/groups/${groupId}/admin-policy`, {
            discord_perms_grant_admin: discordPermsGrantAdmin,
          }),
        ),
      () => mockAuthorizedUsers(),
    );
  },


  // --- Event managers (web64a: full event control, no group admin) --------
  async groupEventManagers(groupId: number): Promise<EventManagersResponse> {
    return withFallback(
      async () =>
        EventManagersResponseSchema.parse(
          await apiGet(`/groups/${groupId}/event-managers`, { authed: true }),
        ),
      () => mockEventManagers(),
    );
  },


  /** Add by Discord ID (snowflake) or DropTracker username. */
  async addGroupEventManager(
    groupId: number,
    identifier: string,
  ): Promise<EventManagersResponse> {
    return withFallback(
      async () =>
        EventManagersResponseSchema.parse(
          await apiSend("POST", `/groups/${groupId}/event-managers`, { identifier }),
        ),
      () => mockEventManagers(),
    );
  },


  async removeGroupEventManager(
    groupId: number,
    userId: number,
  ): Promise<EventManagersResponse> {
    return withFallback(
      async () =>
        EventManagersResponseSchema.parse(
          await apiSend("DELETE", `/groups/${groupId}/event-managers`, { user_id: userId }),
        ),
      () => mockEventManagers(),
    );
  },


  async setHiddenPlayer(groupId: number, playerId: number, hidden: boolean): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("PATCH", `/groups/${groupId}/hidden-players`, {
          player_id: playerId,
          hidden,
        });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  /**
   * Items / NPCs this group never wants announced in its Discord channels.
   * Muting is announcement-only — the submission is still recorded, scored and
   * counted everywhere else.
   */
  async groupNotificationBlacklist(groupId: number): Promise<NotificationBlacklist> {
    return withFallback(
      async () =>
        NotificationBlacklistSchema.parse(
          await apiGet(`/groups/${groupId}/notification-blacklist`, { authed: true }),
        ),
      () => mockNotificationBlacklist(),
    );
  },


  /** Add one entry. `gameId` is the item/npc id behind the picker's icon; pass
   * null for a hand-typed name the catalog may not carry. The backend is
   * idempotent, so re-adding what is already muted returns the same list. */
  async addGroupNotificationBlacklistEntry(
    groupId: number,
    entryType: BlacklistEntryType,
    name: string,
    gameId: number | null = null,
  ): Promise<NotificationBlacklist> {
    return withFallback(
      async () =>
        NotificationBlacklistSchema.parse(
          await apiSend("POST", `/groups/${groupId}/notification-blacklist`, {
            entry_type: entryType,
            name,
            game_id: gameId,
          }),
        ),
      () => mockNotificationBlacklist(),
    );
  },


  async removeGroupNotificationBlacklistEntry(
    groupId: number,
    entryId: number,
  ): Promise<NotificationBlacklist> {
    return withFallback(
      async () =>
        NotificationBlacklistSchema.parse(
          await apiSend("DELETE", `/groups/${groupId}/notification-blacklist/${entryId}`, {}),
        ),
      () => mockNotificationBlacklist(),
    );
  },


  async womSync(groupId: number): Promise<WomSyncResult> {
    return withFallback(
      async () =>
        WomSyncResultSchema.parse(await apiSend("POST", `/groups/${groupId}/wom-sync`, {})),
      () => mockWomSync(),
    );
  },


  async diagnostics(groupId: number): Promise<GroupDiagnostics> {
    return withFallback(
      async () =>
        GroupDiagnosticsSchema.parse(
          await apiGet(`/groups/${groupId}/diagnostics`, { authed: true }),
        ),
      () => mockDiagnostics(),
    );
  },


  // --- Group creation wizard --------------------------------------------
  async womLookup(womId: number): Promise<WomGroupPreview> {
    return withFallback(
      async () =>
        WomGroupPreviewSchema.parse(await apiGet(`/groups/wom-lookup/${womId}`, { authed: true })),
      () => mockWomLookup(womId),
    );
  },


  async guildStatus(guildId: string, opts?: { refresh?: boolean }): Promise<GuildStatus> {
    // refresh=1 busts the backend's 5-minute bot-presence cache — used by the
    // wizard's invite-the-bot poll so a fresh invite is detected promptly.
    const suffix = opts?.refresh ? "?refresh=1" : "";
    return withFallback(
      async () =>
        GuildStatusSchema.parse(
          await apiGet(`/groups/guild-status/${encodeURIComponent(guildId)}${suffix}`, {
            authed: true,
          }),
        ),
      () => mockGuildStatus(guildId),
    );
  },


  async createGroup(input: CreateGroupInput): Promise<CreateGroupResult> {
    return withFallback(
      async () => CreateGroupResultSchema.parse(await apiSend("POST", `/groups`, input)),
      () => ({
        id: Math.floor(100 + Math.random() * 900),
        name: input.name,
        wom_id: input.wom_id,
        guild_id: input.guild_id,
      }),
    );
  },


  /** Discord servers the caller can manage (wizard server picker). */
  async manageableGuilds(): Promise<MyGuilds> {
    return withFallback(
      async () => MyGuildsSchema.parse(await apiGet(`/me/guilds`, { authed: true })),
      () => ({ guilds: mockManageableGuilds(), cached: true }),
    );
  },


  /** Public bot application info for the wizard's "Invite the bot" button. */
  async botInvite(): Promise<BotInvite> {
    return withFallback(
      async () => BotInviteSchema.parse(await apiGet(`/meta/bot-invite`, { revalidate: 3600 })),
      () => mockBotInvite(),
    );
  },
};
