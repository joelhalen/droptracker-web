import { z } from "zod";
import { apiGet } from "./_client";

/** One setting's value as the plugin reported it (boolean, number or enum name). */
const SettingValueSchema = z.union([z.boolean(), z.number(), z.string(), z.null()]);

export const PluginConfigSchema = z.object({
  player: z.object({ id: z.number(), name: z.string().nullable() }),
  snapshot: z
    .object({
      captured_at: z.string().nullable(),
      plugin_version: z.string().nullable(),
      runelite_version: z.string().nullable(),
      transport: z.enum(["api", "webhook"]).nullable(),
      settings: z.record(z.string(), z.record(z.string(), SettingValueSchema)),
      customized: z.array(z.string()),
      env: z.record(z.string(), SettingValueSchema),
      previous_captured_at: z.string().nullable(),
      changed_since_previous: z.array(
        z.object({
          key: z.string(),
          from: SettingValueSchema.optional(),
          to: SettingValueSchema.optional(),
        }),
      ),
    })
    .nullable(),
});

export type PluginConfig = z.infer<typeof PluginConfigSchema>;
export type PluginSettingValue = z.infer<typeof SettingValueSchema>;

export const pluginConfigApi = {
  /** A group member's plugin settings (group admins). */
  async groupMemberPluginConfig(groupId: number, playerId: number): Promise<PluginConfig> {
    return PluginConfigSchema.parse(
      await apiGet(`/groups/${groupId}/members/${playerId}/plugin-config`, { authed: true }),
    );
  },

  /** Any player's plugin settings (support staff). */
  async staffPlayerPluginConfig(playerId: number): Promise<PluginConfig> {
    return PluginConfigSchema.parse(
      await apiGet(`/admin/players/${playerId}/plugin-config`, { authed: true }),
    );
  },
};
