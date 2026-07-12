/**
 * Tier entitlement registry — machine-readable capabilities unlocked by a
 * group's subscription tier (Task 15 / tier-permissions plan).
 *
 * Mirrors the `group-config.ts` pattern: a shared registry in api-types,
 * Python parity in `disc/web_api/entitlements_registry.py`, Zod validation,
 * and superadmin configuration on `/admin/tiers`.
 *
 * Distinct from `SubscriptionTier.features[]`, which is marketing copy for the
 * pricing page. Entitlements drive runtime access control.
 */
import { z } from "zod";

export type EntitlementCategory = "features" | "supporter";

export interface EntitlementField {
  key: string;
  label: string;
  category: EntitlementCategory;
  help: string;
  /** Value shape; boolean when omitted. */
  kind?: "bool" | "int";
  /** Default for tiers that explicitly configure entitlements (missing key). */
  default: boolean | number;
}

export const ENTITLEMENT_CATEGORIES: { id: EntitlementCategory; label: string }[] = [
  { id: "features", label: "Features" },
  { id: "supporter", label: "Supporter perks" },
];

/** Who a subscription tier applies to (subscription_tiers.scope). */
export type TierScope = "group" | "user";

/** Stable machine ids — referenced by UI gates and backend enforcement. */
export const ENTITLEMENT_FIELDS: EntitlementField[] = [
  {
    key: "events",
    label: "Events",
    category: "features",
    help: "Create and manage group events (tasks, teams, scoreboards).",
    default: false,
  },
  {
    key: "events_max_active",
    label: "Max active events",
    category: "features",
    help: "How many events a group may have active at the same time (enforced at activation; drafts are unlimited).",
    kind: "int",
    default: 1,
  },
  {
    key: "hall_of_fame",
    label: "Hall of Fame",
    category: "features",
    help: "Hall of Fame personal-best embeds and boss leaderboards in Discord.",
    default: false,
  },
  {
    key: "custom_embeds",
    label: "Custom Discord embeds",
    category: "features",
    help: "Customize the Discord embeds the bot posts for drops, collection logs, personal bests, combat achievements, pets and the lootboard.",
    default: false,
  },
  {
    key: "video_submissions",
    label: "Video submissions",
    category: "features",
    help: "Members can capture and upload short video clips of drops, personal bests and other achievements instead of screenshots.",
    default: false,
  },
  {
    key: "custom_points",
    label: "Custom points system",
    category: "features",
    help: "Configure a custom point system: award rules per submission type, per-item/NPC overrides, timed boosts, and points leaderboards.",
    default: false,
  },
];

export type EntitlementKey = (typeof ENTITLEMENT_FIELDS)[number]["key"];

export const ENTITLEMENT_KEYS = ENTITLEMENT_FIELDS.map((f) => f.key) as EntitlementKey[];

/**
 * User-scoped ("supporter") entitlements — granted by a user_subscriptions
 * row to a tier with scope="user". Personal perks, independent of any group
 * tier. Python parity: `USER_ENTITLEMENT_FIELDS` in `disc/db/entitlements.py`.
 */
export const USER_ENTITLEMENT_FIELDS: EntitlementField[] = [
  {
    key: "dm_submissions",
    label: "Submission DMs",
    category: "supporter",
    help: "Receive Discord DMs for your own drops, personal bests, collection log slots and other achievements, filtered by your own settings.",
    default: false,
  },
  {
    key: "supporter_flair",
    label: "Supporter flair",
    category: "supporter",
    help: "A distinct supporter display style on your public profile and site listings.",
    default: false,
  },
  {
    key: "video_submissions",
    label: "Personal video submissions",
    category: "supporter",
    help: "Capture and upload short video clips of your own submissions, independent of whether any of your groups has video submissions enabled.",
    default: false,
  },
];

export type UserEntitlementKey = (typeof USER_ENTITLEMENT_FIELDS)[number]["key"];

export const USER_ENTITLEMENT_KEYS = USER_ENTITLEMENT_FIELDS.map(
  (f) => f.key,
) as UserEntitlementKey[];

export function entitlementFieldsForScope(scope: TierScope): EntitlementField[] {
  return scope === "user" ? USER_ENTITLEMENT_FIELDS : ENTITLEMENT_FIELDS;
}

/**
 * Group-config keys that require the Hall of Fame entitlement.
 * Must stay in sync with HALL_OF_FAME_CONFIG_KEYS in the backend
 * (disc: db/entitlements.py). notify_pbs is intentionally excluded — plain PB
 * notifications are available to every group.
 */
export const HALL_OF_FAME_CONFIG_KEYS = [
  "create_pb_embeds",
  "personal_best_embed_boss_list",
  "number_of_pbs_to_display",
  "channel_id_to_send_pb_embeds",
  "hof_individual_boss_messages",
] as const;

export function getEntitlementField(key: string): EntitlementField | undefined {
  return ENTITLEMENT_FIELDS.find((f) => f.key === key);
}

const fieldValueSchema = (f: EntitlementField) =>
  f.kind === "int" ? z.number().int().nonnegative() : z.boolean();

/**
 * Per-tier entitlement map stored on `subscription_tiers.entitlements`.
 * Accepts keys from BOTH scopes so user-tier payloads survive the shared tier
 * CRUD path; the backend validates strictly against the tier's actual scope.
 */
export const TierEntitlementsSchema = z.object(
  Object.fromEntries(
    [...ENTITLEMENT_FIELDS, ...USER_ENTITLEMENT_FIELDS].map((f) => [
      f.key,
      fieldValueSchema(f).optional(),
    ]),
  ),
);
export type TierEntitlements = z.infer<typeof TierEntitlementsSchema>;

/** Resolved entitlements for a group (every registry key present). */
export const GroupEntitlementsSchema = z.object(
  Object.fromEntries(ENTITLEMENT_FIELDS.map((f) => [f.key, fieldValueSchema(f)])),
);
export type GroupEntitlements = z.infer<typeof GroupEntitlementsSchema>;

/** Resolved supporter entitlements for a user (every registry key present). */
export const UserEntitlementsSchema = z.object(
  Object.fromEntries(USER_ENTITLEMENT_FIELDS.map((f) => [f.key, fieldValueSchema(f)])),
);
export type UserEntitlements = z.infer<typeof UserEntitlementsSchema>;

/** Input for tier CRUD — partial map is fine; resolver fills gaps. */
export const TierEntitlementsInputSchema = TierEntitlementsSchema;
export type TierEntitlementsInput = TierEntitlements;
