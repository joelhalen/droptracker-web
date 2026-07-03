"use client";

import Link from "next/link";
import type { Route } from "next";
import type { EntitlementKey, GroupSubscription, SubscriptionTier } from "@droptracker/api-types";
import { getEntitlementField } from "@droptracker/api-types";
import { hasEntitlement, lowestTierWithEntitlement } from "@/lib/entitlements";
import { Card } from "@/components/ui";

/**
 * Renders children when the group has an entitlement; otherwise an upgrade card.
 * Superadmins always pass through.
 */
export function FeatureGate({
  entitlement,
  subscription,
  tiers,
  groupId,
  isSuperadmin = false,
  children,
}: {
  entitlement: EntitlementKey;
  subscription: GroupSubscription | null;
  tiers: SubscriptionTier[];
  groupId: number;
  isSuperadmin?: boolean;
  children: React.ReactNode;
}) {
  if (hasEntitlement(subscription, entitlement, { isSuperadmin })) {
    return <>{children}</>;
  }

  const field = getEntitlementField(entitlement);
  const upgradeTier = lowestTierWithEntitlement(tiers, entitlement);

  return (
    <Card padding="p-6" className="border-osrs-gold/30">
      <h2 className="text-osrs-gold text-lg font-semibold">
        {field?.label ?? entitlement} requires an upgrade
      </h2>
      <p className="text-osrs-parchment-dark/80 mt-2 text-sm">
        {field?.help ?? "This feature is not included in your group's current subscription tier."}
      </p>
      {upgradeTier && (
        <p className="text-osrs-parchment-dark/70 mt-2 text-sm">
          Available on the <span className="text-osrs-gold-bright font-medium">{upgradeTier.name}</span>{" "}
          plan and above.
        </p>
      )}
      <Link
        href={`/groups/${groupId}/subscription` as Route}
        className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark mt-4 inline-block rounded px-4 py-2 text-sm font-medium"
      >
        View subscription options
      </Link>
    </Card>
  );
}
