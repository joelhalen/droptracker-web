import type { Metadata } from "next";
import { api } from "@/lib/api";
import { EventRateLimitsManager } from "@/components/admin/event-rate-limits-manager";

export const metadata: Metadata = { title: "Event limits" };

export default async function AdminEventLimitsPage() {
  const [tiers, types, limits] = await Promise.all([
    api.subscriptionTiers("group"),
    api.adminEventTypes(),
    api.adminEventRateLimits(),
  ]);

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Per-tier caps on how many events a group may <em>run</em> per rolling time window —
        one cap per event format, plus an all-formats total per tier. Caps bind when an event
        activates (drafts are never counted). A scope with no rule is unlimited, so with
        nothing configured events stay governed by the Events entitlement alone.
      </p>
      <EventRateLimitsManager tiers={tiers} types={types} initial={limits} />
    </div>
  );
}
