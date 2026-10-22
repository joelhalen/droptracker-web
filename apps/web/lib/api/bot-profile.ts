import { z } from "zod";
import { apiGet, apiSend, apiSendForm } from "./_client";
import {
  AdminBotProfilesResponseSchema,
  BotProfileSchema,
  type AdminBotProfilesResponse,
  type BotProfile,
  type BotProfileImageKind,
  type BotProfileInput,
} from "@droptracker/api-types";

/**
 * Custom bot profile (web139a): the bot's nickname, bio, avatar and banner in
 * a group's Discord server. Images are staged by upload and only take effect
 * with a save, which the core bot applies within seconds. Backend: web_api/routes/bot_profile.py.
 */
export const botProfileApi = {
  async groupBotProfile(groupId: number): Promise<BotProfile> {
    return BotProfileSchema.parse(await apiGet(`/groups/${groupId}/bot-profile`, { authed: true }));
  },

  async saveGroupBotProfile(groupId: number, input: BotProfileInput): Promise<BotProfile> {
    return BotProfileSchema.parse(await apiSend("PUT", `/groups/${groupId}/bot-profile`, input));
  },

  /** Stage an image for the next save. The bot does not change until saveGroupBotProfile. */
  async uploadGroupBotImage(groupId: number, kind: BotProfileImageKind, form: FormData): Promise<{ url: string }> {
    return z
      .object({ url: z.string() })
      .parse(await apiSendForm("POST", `/groups/${groupId}/bot-profile/uploads/${kind}`, form));
  },

  async resetGroupBotProfile(groupId: number): Promise<BotProfile> {
    return BotProfileSchema.parse(await apiSend("DELETE", `/groups/${groupId}/bot-profile`, {}));
  },

  /** Staff: every group's custom bot profile, newest change first. */
  async adminBotProfiles(): Promise<AdminBotProfilesResponse> {
    return AdminBotProfilesResponseSchema.parse(await apiGet(`/admin/bot-profiles`, { authed: true }));
  },

  /** Superadmin: put a group's bot back to its default look. */
  async adminResetBotProfile(groupId: number): Promise<{ ok: boolean }> {
    return (await apiSend("POST", `/admin/bot-profiles/${groupId}/reset`, {})) as { ok: boolean };
  },
};
