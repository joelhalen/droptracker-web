import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { SubscriptionManager } from "@/components/subscription-manager";

export const metadata: Metadata = { title: "Subscription" };

type Params = Promise<{ id: string }>;

// Access is gated by the (admin)/groups/[id] layout.
export default async function GroupSubscriptionPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  const [tiers, subscription] = await Promise.all([
    api.subscriptionTiers(),
    api.groupSubscription(groupId),
  ]);

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Manage this group&apos;s recurring subscription. Billing is handled by our payment provider.
      </p>
      <SubscriptionManager groupId={groupId} tiers={tiers} initial={subscription} />
    </div>
  );
}
