import {
  DiscordRelayIntegrationSchema,
  DiscordRelayListSchema,
  DiscordRelayLogSchema,
  type DiscordRelayFeature,
  type DiscordRelayIntegration,
  type DiscordRelayList,
  type DiscordRelayLog,
  type DiscordRelayStatus,
} from "@droptracker/api-types";
import { apiGet, apiSend } from "./_client";

/**
 * Discord delivery relay (web153a): a group's own bot posts DropTracker's
 * messages in its server. Staff only. Backend: web_api/routes/discord_relay_admin.py.
 */
export type DiscordRelayInput = {
  group_id?: number;
  label?: string;
  application_id?: string | null;
  guild_ids?: string[];
  features?: DiscordRelayFeature[];
  status?: DiscordRelayStatus;
  hold_minutes?: number;
  notes?: string | null;
  /** Create only: bind the group's existing key instead of minting one. */
  api_key_id?: number;
};

export const discordRelayApi = {
  async adminDiscordRelays(): Promise<DiscordRelayList> {
    return DiscordRelayListSchema.parse(await apiGet(`/admin/discord-relay`, { authed: true }));
  },

  /** Starts paused. A minted token is in the response ONCE. */
  async adminCreateDiscordRelay(input: DiscordRelayInput): Promise<DiscordRelayIntegration> {
    return DiscordRelayIntegrationSchema.parse(await apiSend("POST", `/admin/discord-relay`, input));
  },

  async adminUpdateDiscordRelay(id: number, input: DiscordRelayInput): Promise<DiscordRelayIntegration> {
    return DiscordRelayIntegrationSchema.parse(
      await apiSend("PATCH", `/admin/discord-relay/${id}`, input),
    );
  },

  /** Revokes the current key and mints a new one (token in the response ONCE). */
  async adminRotateDiscordRelayKey(id: number): Promise<DiscordRelayIntegration> {
    return DiscordRelayIntegrationSchema.parse(
      await apiSend("POST", `/admin/discord-relay/${id}/rotate-key`, {}),
    );
  },

  async adminDeleteDiscordRelay(id: number): Promise<void> {
    await apiSend("DELETE", `/admin/discord-relay/${id}`, {});
  },

  async adminDiscordRelayLog(id: number): Promise<DiscordRelayLog> {
    return DiscordRelayLogSchema.parse(await apiGet(`/admin/discord-relay/${id}/log`, { authed: true }));
  },
};
