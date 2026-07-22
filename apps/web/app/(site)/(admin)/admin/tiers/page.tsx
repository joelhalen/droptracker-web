import type { Metadata } from "next";
import { api } from "@/lib/api";
import { TierManager } from "@/components/tier-manager";

export const metadata: Metadata = { title: "Subscription tiers" };

export default async function AdminTiersPage() {
  // include_free so the $0 fallback tier (the non-premium plan configured on
  // /admin/event-limits) is visible and editable here too.
  const tiers = await api.subscriptionTiers("all", { includeFree: true });

  return (
    <div className="max-w-2xl">
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Define the recurring subscription tiers groups can choose from. Changes appear on the public
        pricing page.
      </p>
      <TierManager tiers={tiers} />
    </div>
  );
}
