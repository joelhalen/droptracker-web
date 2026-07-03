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

export type EntitlementCategory = "features";

export interface EntitlementField {
  key: string;
  label: string;
  category: EntitlementCategory;
  help: string;
  /** Default for tiers that explicitly configure entitlements (missing key). */
  default: boolean;
}

export const ENTITLEMENT_CATEGORIES: { id: EntitlementCategory; label: string }[] = [
  { id: "features", label: "Features" },
];

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
    key: "hall_of_fame",
    label: "Hall of Fame",
    category: "features",
    help: "Hall of Fame personal-best embeds and boss leaderboards in Discord.",
    default: false,
  },
];

export type EntitlementKey = (typeof ENTITLEMENT_FIELDS)[number]["key"];

export const ENTITLEMENT_KEYS = ENTITLEMENT_FIELDS.map((f) => f.key) as EntitlementKey[];

/** Group-config keys that require the Hall of Fame entitlement. */
export const HALL_OF_FAME_CONFIG_KEYS = [
  "personal_best_embed_boss_list",
  "hof_individual_boss_messages",
] as const;

export function getEntitlementField(key: string): EntitlementField | undefined {
  return ENTITLEMENT_FIELDS.find((f) => f.key === key);
}

/** Per-tier entitlement map stored on `subscription_tiers.entitlements`. */
export const TierEntitlementsSchema = z.object(
  Object.fromEntries(ENTITLEMENT_FIELDS.map((f) => [f.key, z.boolean().optional()])),
);
export type TierEntitlements = z.infer<typeof TierEntitlementsSchema>;

/** Resolved entitlements for a group (every registry key present). */
export const GroupEntitlementsSchema = z.object(
  Object.fromEntries(ENTITLEMENT_FIELDS.map((f) => [f.key, z.boolean()])),
);
export type GroupEntitlements = z.infer<typeof GroupEntitlementsSchema>;

/** Input for tier CRUD — partial map is fine; resolver fills gaps. */
export const TierEntitlementsInputSchema = TierEntitlementsSchema;
export type TierEntitlementsInput = TierEntitlements;
