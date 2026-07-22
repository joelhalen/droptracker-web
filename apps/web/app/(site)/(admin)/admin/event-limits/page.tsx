import type { Metadata } from "next";
import { api } from "@/lib/api";
import { EventRateLimitsManager } from "@/components/admin/event-rate-limits-manager";

export const metadata: Metadata = { title: "Event limits" };

export default async function AdminEventLimitsPage() {
  const [tiers, types, limits] = await Promise.all([
    // include_free surfaces the $0 fallback tier so non-premium groups get a
    // configurable trial row at the top of the matrix.
    api.subscriptionTiers("group", { includeFree: true }),
    api.adminEventTypes(),
    api.adminEventRateLimits(),
  ]);

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Per-tier caps on how many events a group may <em>run</em> per rolling time window —
        one cap per event format, plus an all-formats total per tier. Caps bind when an event
        activates (drafts are never counted). A scope with no rule is unlimited, so with
        nothing configured events stay governed by the Events entitlement alone. The{" "}
        <strong>Free</strong> card at the top covers regular non-premium groups: a cap above zero
        there lets groups without a paid subscription run that many trial events per window.
      </p>
      <EventRateLimitsManager tiers={tiers} types={types} initial={limits} />
    </div>
  );
}
