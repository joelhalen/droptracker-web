import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { ConfigEditor } from "@/components/config-editor";
import { GroupIconCard } from "@/components/group-icon-card";

export const metadata: Metadata = { title: "Group settings" };

type Params = Promise<{ id: string }>;

// Access is gated by the (admin)/groups/[id] layout.
export default async function GroupSettingsPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  const [config, subscription, tiers, user, group, seasonal] = await Promise.all([
    api.groupConfig(groupId),
    api.groupSubscription(groupId).catch(() => null),
    api.subscriptionTiers().catch(() => []),
    getUser(),
    // Icon lives on the public profile payload; non-critical for settings.
    api.group(groupId).catch(() => null),
    api.seasonalStatus().catch(() => ({ active: true })),
  ]);

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Notification, lootboard, points, and integration configuration.
      </p>
      <GroupIconCard groupId={groupId} initialIconUrl={group?.icon_url} />
      <ConfigEditor
        groupId={groupId}
        initial={config}
        subscription={subscription}
        tiers={tiers}
        isSuperadmin={user?.is_superadmin}
        seasonalActive={seasonal.active}
      />
    </div>
  );
}
