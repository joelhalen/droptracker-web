import { apiGet, apiSend, withFallback } from "./_client";
import { type EventDiscordGuildList, type EventDiscordChannelList } from "./types";
import {
  EventChannelConfigSchema,
  EventTeamDiscordConfigSchema,
  type EventTeamDiscordConfig,
  type EventTeamDiscordInput,
  TeamNotificationsSchema,
  type TeamNotifications,
  type EventTaskProgressMode,
  type GroupDiscordRoles,
  GroupDiscordRolesSchema,
  type EventChannelConfig,
  type EventChannelConfigInput,
} from "@droptracker/api-types";
import {
  mockEventDiscord,
  mockEventTeamDiscord,
  mockEventDiscordChannels,
  mockEventDiscordGuilds,
} from "../mock-data";

export const eventDiscordApi = {

  // --- Event Discord destinations (Task 19) --------------------------------
  /** The event's Discord destination config (admin-only). */
  async eventDiscord(eventId: number, groupId?: number | null): Promise<EventChannelConfig> {
    const suffix = groupId != null ? `?group_id=${groupId}` : "";
    return withFallback(
      async () =>
        EventChannelConfigSchema.parse(
          await apiGet(`/events/${eventId}/discord${suffix}`, { authed: true }),
        ),
      () => mockEventDiscord(eventId),
    );
  },


  /** Replace the event's Discord destination (guild + per-kind channels).
   * With `input.group_id`, writes that clan's own per-group scope (web48a). */
  async updateEventDiscord(
    eventId: number,
    input: EventChannelConfigInput,
  ): Promise<EventChannelConfig> {
    return withFallback(
      async () =>
        EventChannelConfigSchema.parse(await apiSend("PUT", `/events/${eventId}/discord`, input)),
      () => ({
        guild_id: input.guild_id,
        guild_name: null,
        channels: input.channels,
        discord_event_policy: input.discord_event_policy ?? "on_activate",
        pings: input.pings ?? {},
        // Mirror the backend PUT contract: absent = leave unchanged (defaults).
        messages: input.messages ?? mockEventDiscord(eventId).messages,
        per_group_discord: input.per_group_discord ?? false,
        group_id: input.group_id ?? null,
      }),
    );
  },


  /** Every guild the bot is in (bot-maintained Redis cache; never a live Discord call). */
  async eventDiscordGuilds(): Promise<EventDiscordGuildList> {
    return withFallback(
      async () =>
        (await apiGet(`/events/discord/guilds`, { authed: true })) as EventDiscordGuildList,
      () => mockEventDiscordGuilds(),
    );
  },


  /** Text channels of one guild (any guild the bot is in, not just group home guilds). */
  async eventDiscordChannels(guildId: string): Promise<EventDiscordChannelList> {
    return withFallback(
      async () =>
        (await apiGet(`/events/discord/guilds/${encodeURIComponent(guildId)}/channels`, {
          authed: true,
        })) as EventDiscordChannelList,
      () => mockEventDiscordChannels(guildId),
    );
  },


  /** Roles of one guild, for the event ping-role pickers (same bot cache
   * pipeline as the channel list; `stale: true` while the cache warms). */
  async eventDiscordRoles(guildId: string): Promise<GroupDiscordRoles> {
    return withFallback(
      async () =>
        GroupDiscordRolesSchema.parse(
          await apiGet(`/events/discord/guilds/${encodeURIComponent(guildId)}/roles`, {
            authed: true,
          }),
        ),
      () => ({ roles: [], stale: false }),
    );
  },


  /** Per-team Discord channels & roles config + live provisioning state
   * (web53a). `groupId` selects a participating clan's own scope. */
  async eventTeamDiscord(
    eventId: number,
    groupId?: number | null,
  ): Promise<EventTeamDiscordConfig> {
    const suffix = groupId != null ? `?group_id=${groupId}` : "";
    return withFallback(
      async () =>
        EventTeamDiscordConfigSchema.parse(
          await apiGet(`/events/${eventId}/team-discord${suffix}`, { authed: true }),
        ),
      () => mockEventTeamDiscord(eventId, groupId ?? null),
    );
  },


  /** Save one scope of the team-discord config; the bot provisions within
   * ~30s of the save. Absent keys leave stored values unchanged. */
  async updateEventTeamDiscord(
    eventId: number,
    input: EventTeamDiscordInput,
  ): Promise<EventTeamDiscordConfig> {
    return withFallback(
      async () =>
        EventTeamDiscordConfigSchema.parse(
          await apiSend("PUT", `/events/${eventId}/team-discord`, input),
        ),
      () => mockEventTeamDiscord(eventId, input.group_id ?? null),
    );
  },


  /** Current effective notification state for one team's channel (captain or
   * event admin — the modal seeds from this). */
  async teamNotifications(eventId: number, teamId: number): Promise<TeamNotifications> {
    return withFallback(
      async () =>
        TeamNotificationsSchema.parse(
          await apiGet(`/events/${eventId}/teams/${teamId}/notifications`, {
            authed: true,
          }),
        ),
      () => ({ team_id: teamId, toggles: {}, pings: {}, task_progress: "milestones" }),
    );
  },


  /** Captain/admin: tune which notifications one team's channel receives and
   * which of them mention @TeamRole. */
  async updateTeamNotifications(
    eventId: number,
    teamId: number,
    input: {
      toggles?: Record<string, boolean>;
      pings?: Record<string, boolean>;
      task_progress?: EventTaskProgressMode;
    },
  ): Promise<TeamNotifications> {
    return withFallback(
      async () =>
        TeamNotificationsSchema.parse(
          await apiSend("PUT", `/events/${eventId}/teams/${teamId}/notifications`, input),
        ),
      () => ({
        team_id: teamId,
        toggles: input.toggles ?? {},
        pings: input.pings ?? {},
        task_progress: input.task_progress ?? "milestones",
      }),
    );
  },
};
