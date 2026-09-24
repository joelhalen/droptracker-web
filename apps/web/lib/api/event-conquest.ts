import { apiGet, apiSend, apiSendForm } from "./_client";
import {
  ConquestBattlesPageSchema,
  ConquestMapSchema,
  ConquestPresetOptionsSchema,
  ConquestSettingsSchema,
  type ConquestBattlesPage,
  type ConquestMap,
  type ConquestMapInput,
  type ConquestPresetOptions,
  type ConquestSettings,
} from "@droptracker/api-types";

/** Conquest events (web120a): the territory map, its designer and the admin
 * corrections. Reads forward the session when present (private events) and
 * tolerate anonymous viewers; writes need the event admin gate upstream. */
export const eventConquestApi = {
  /** The map + live state: regions, tiles (owner, defense, rules and each
   * team's progress to its next troop), live standings, latest battles. */
  async eventConquest(eventId: number): Promise<ConquestMap> {
    return ConquestMapSchema.parse(
      await apiGet(`/events/${eventId}/conquest`, { authed: true }),
    );
  },

  /** The map for the chrome-less board-image render (internal render token). */
  async eventConquestForRender(eventId: number, token: string): Promise<ConquestMap> {
    return ConquestMapSchema.parse(
      await apiGet(`/events/${eventId}/conquest`, { internalToken: token }),
    );
  },

  /** One page of the battle log, newest first. */
  async eventConquestBattles(
    eventId: number,
    opts: { before?: number | null; tileId?: number | null; teamId?: number | null; limit?: number } = {},
  ): Promise<ConquestBattlesPage> {
    const qs = new URLSearchParams();
    if (opts.before) qs.set("before", String(opts.before));
    if (opts.tileId) qs.set("tile_id", String(opts.tileId));
    if (opts.teamId) qs.set("team_id", String(opts.teamId));
    if (opts.limit) qs.set("limit", String(opts.limit));
    const q = qs.toString();
    return ConquestBattlesPageSchema.parse(
      await apiGet(`/events/${eventId}/conquest/battles${q ? `?${q}` : ""}`, { authed: true }),
    );
  },

  /** The designer's preset panel: presets + a troop cost sized to the event. */
  async eventConquestPresets(eventId: number): Promise<ConquestPresetOptions> {
    return ConquestPresetOptionsSchema.parse(
      await apiGet(`/events/${eventId}/conquest/presets`, { authed: true }),
    );
  },

  /** Replace the whole map (draft only). */
  async saveEventConquestMap(eventId: number, input: ConquestMapInput): Promise<ConquestMap> {
    return ConquestMapSchema.parse(
      await apiSend("PUT", `/events/${eventId}/conquest/map`, input),
    );
  },

  /** Build the map from a preset, replacing the current one (draft only). */
  async applyEventConquestPreset(
    eventId: number,
    body: { preset: string; troop_hours?: number; unique_troops?: number },
  ): Promise<ConquestMap> {
    return ConquestMapSchema.parse(
      await apiSend("POST", `/events/${eventId}/conquest/preset`, body),
    );
  },

  /** Merge settings (any time). Returns the effective settings. */
  async patchEventConquestSettings(
    eventId: number,
    patch: Partial<ConquestSettings>,
  ): Promise<ConquestSettings> {
    const res = (await apiSend("PATCH", `/events/${eventId}/conquest/settings`, patch)) as {
      settings: unknown;
    };
    return ConquestSettingsSchema.parse(res.settings);
  },

  /** Upload map art (multipart `file`). */
  async uploadEventConquestBackground(
    eventId: number,
    form: FormData,
  ): Promise<{ background_url: string; bg_width: number; bg_height: number }> {
    return (await apiSendForm("POST", `/events/${eventId}/conquest/background`, form)) as {
      background_url: string;
      bg_width: number;
      bg_height: number;
    };
  },

  /** Drop the uploaded art (back to the drawn map). */
  async clearEventConquestBackground(eventId: number): Promise<void> {
    await apiSend("DELETE", `/events/${eventId}/conquest/background`, {});
  },

  /** Set a tile's owner/defense by hand while the event runs. */
  async adjustEventConquestTile(
    eventId: number,
    tileId: number,
    body: { owner_team_id: number | null; defense?: number },
  ): Promise<{ tile_id: number; owner_team_id: number | null; defense: number }> {
    return (await apiSend(
      "POST",
      `/events/${eventId}/conquest/tiles/${tileId}/adjust`,
      body,
    )) as { tile_id: number; owner_team_id: number | null; defense: number };
  },
};
