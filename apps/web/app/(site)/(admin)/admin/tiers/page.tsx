import type { Metadata } from "next";
import { api } from "@/lib/api";
import { TierManager } from "@/components/tier-manager";
import { requireSuperadmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Subscription tiers" };

export default async function AdminTiersPage() {
  await requireSuperadmin("/admin/tiers");
  // include_free so the $0 fallback tier (the non-premium plan configured on
  // /admin/event-limits) is visible and editable here too.
  const [tiers, eventLimits] = await Promise.all([
    api.subscriptionTiers("all", { includeFree: true }),
    // Event access is also granted by these rules, so the editor shows them.
    api.adminEventRateLimits(),
  ]);

  return (
    <div className="max-w-6xl">
      <TierManager tiers={tiers} eventLimits={eventLimits} />
    </div>
  );
}
