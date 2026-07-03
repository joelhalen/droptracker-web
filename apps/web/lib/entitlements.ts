/**
 * Client/server helpers for tier entitlements. The Web API resolves entitlements
 * on `GET /groups/{id}/subscription`; these helpers interpret that payload.
 */
import {
  ENTITLEMENT_FIELDS,
  type EntitlementKey,
  type GroupEntitlements,
  type GroupSubscription,
  type SubscriptionTier,
} from "@droptracker/api-types";

/** Subscription statuses that confer tier entitlements. */
export function isSubscriptionActive(sub: GroupSubscription): boolean {
  return sub.status === "active" || sub.status === "trialing";
}

/** Restrictive baseline (matches registry defaults). */
export function defaultEntitlements(): GroupEntitlements {
  return Object.fromEntries(ENTITLEMENT_FIELDS.map((f) => [f.key, f.default])) as GroupEntitlements;
}

/** All entitlements granted (superadmin bypass only). */
export function allEntitlementsGranted(): GroupEntitlements {
  return Object.fromEntries(ENTITLEMENT_FIELDS.map((f) => [f.key, true])) as GroupEntitlements;
}

/** Normalize a subscription payload to a full entitlement map. */
export function getEntitlements(sub: GroupSubscription | null | undefined): GroupEntitlements {
  if (sub?.entitlements) return sub.entitlements;
  return defaultEntitlements();
}

export function hasEntitlement(
  sub: GroupSubscription | null | undefined,
  key: EntitlementKey,
  opts?: { isSuperadmin?: boolean },
): boolean {
  if (opts?.isSuperadmin) return true;
  return Boolean(getEntitlements(sub)[key]);
}

/** Lowest-priced active tier that includes an entitlement (for upgrade hints). */
export function lowestTierWithEntitlement(
  tiers: SubscriptionTier[],
  key: EntitlementKey,
): SubscriptionTier | null {
  const matches = tiers.filter((t) => t.entitlements?.[key]);
  if (!matches.length) return null;
  return [...matches].sort((a, b) => a.price_cents - b.price_cents)[0] ?? null;
}
