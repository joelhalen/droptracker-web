import { z } from "zod";

/**
 * A group being registered from the RuneLite plugin
 * (`GET /api/v1/plugin-registrations/{id}`). Held for 30 minutes.
 */
export const PluginRegistrationSchema = z.object({
  name: z.string(),
  status: z.string(),
  group_id: z.number().int().nullable().default(null),
  /** We create the WiseOldMan group from the clan roster the plugin sent. */
  creates_wom: z.boolean(),
  members: z.number().int(),
});
export type PluginRegistration = z.infer<typeof PluginRegistrationSchema>;

/** `POST /api/v1/plugin-registrations/{id}/complete`. The code is shown once
 *  (null when the registration was already complete). */
export const PluginRegistrationResultSchema = z.object({
  group_id: z.number().int(),
  group_name: z.string(),
  verification_code: z.string().nullable().default(null),
});
export type PluginRegistrationResult = z.infer<typeof PluginRegistrationResultSchema>;
