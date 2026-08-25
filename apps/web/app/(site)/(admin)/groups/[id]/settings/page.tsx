import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { NotificationBlacklist } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { getUser, requireGroupAdminPage } from "@/lib/auth";
import { ConfigEditor } from "@/components/config-editor";
import { GroupIconCard } from "@/components/group-icon-card";
import { NotificationBlacklistCard } from "@/components/notification-blacklist-card";
import { TimeframeBoardCard } from "@/components/timeframe-board-card";

export const metadata: Metadata = { title: "Group settings" };

type Params = Promise<{ id: string }>;

// Access is gated by the (admin)/groups/[id] layout.
export default async function GroupSettingsPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();
  await requireGroupAdminPage(groupId); // web64a: event managers only reach Events

  const [config, subscription, tiers, user, group, seasonal, blacklist] = await Promise.all([
    api.groupConfig(groupId),
    api.groupSubscription(groupId).catch(() => null),
    api.subscriptionTiers().catch(() => []),
    getUser(),
    // Icon lives on the public profile payload; non-critical for settings.
    api.group(groupId).catch(() => null),
    api.seasonalStatus().catch(() => ({ active: true })),
    // Best-effort: the rest of the settings page must still render if the
    // blacklist read fails, so the card falls back to an empty list.
    api
      .groupNotificationBlacklist(groupId)
      .catch((): NotificationBlacklist => ({ entries: [], limit: 250 })),
  ]);

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Notification, lootboard, points, and integration configuration.
      </p>
      <GroupIconCard groupId={groupId} initialIconUrl={group?.icon_url} />
      <TimeframeBoardCard groupId={groupId} />
      <NotificationBlacklistCard groupId={groupId} initial={blacklist} />
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
