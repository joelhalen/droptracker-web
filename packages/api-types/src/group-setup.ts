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

/**
 * `GET /groups/{id}/features`: what the group can switch on, and whether it
 * has. One catalog (disc/db/group_features.py) behind the wizard's "Turn
 * things on" step, the admin Overview and the Discord /group-setup panel.
 */
export const FEATURE_KINDS = ["toggle", "channel", "link"] as const;
export const FEATURE_STATUSES = ["on", "off", "locked"] as const;

export const GroupFeatureSchema = z.object({
  key: z.string(),
  title: z.string(),
  blurb: z.string(),
  /** toggle/channel: switch on in place. link: set up on its own page. */
  kind: z.enum(FEATURE_KINDS).catch("link"),
  status: z.enum(FEATURE_STATUSES).catch("off"),
  /** For locked features: the cheapest plan that includes it. */
  tier: z.string().nullish(),
  channel_key: z.string().nullish(),
  /** Site path for the full settings (already has the group id in it). */
  path: z.string(),
});
export type GroupFeature = z.infer<typeof GroupFeatureSchema>;

export const GroupFeaturesSchema = z.object({
  group_id: z.number().int(),
  features: z.array(GroupFeatureSchema),
  summary: z.object({ on: z.number().int(), total: z.number().int() }),
});
export type GroupFeatures = z.infer<typeof GroupFeaturesSchema>;

export const EnableFeatureResultSchema = z.object({
  ok: z.boolean(),
  feature: GroupFeatureSchema.nullish(),
});
export type EnableFeatureResult = z.infer<typeof EnableFeatureResultSchema>;
