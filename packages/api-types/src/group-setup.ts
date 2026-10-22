/**
 * `GET /groups/{id}/setup-status` (web138a): the group setup checklist.
 * Backend: disc/web_api/routes/group_setup.py.
 */
import { z } from "zod";

export const SETUP_CHECK_STATUSES = ["ok", "warn", "fail", "unknown"] as const;

export const SetupCheckSchema = z.object({
  key: z.string(),
  status: z.enum(SETUP_CHECK_STATUSES).catch("unknown"),
  title: z.string(),
  detail: z.string().nullish(),
  /** What the fix button does: invite_bot | pick_channel | link_wom | ... */
  fix: z.string().nullish(),
});
export type SetupCheck = z.infer<typeof SetupCheckSchema>;

export const SetupStatusSchema = z.object({
  group_id: z.number().int(),
  guild_id: z.string().nullable(),
  /** Young or never posted: show the whole checklist even when nothing fails. */
  onboarding: z.boolean().catch(true),
  checks: z.array(SetupCheckSchema),
  alerts: z.array(z.object({ kind: z.string(), since: z.string().nullable(), detail: z.string().nullish() })).catch([]),
  summary: z.object({
    ok: z.number().int(),
    total: z.number().int(),
    failing: z.number().int(),
    headline: z.string().nullable(),
  }),
});
export type SetupStatus = z.infer<typeof SetupStatusSchema>;
