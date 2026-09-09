import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { NotificationBlacklist } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { getUser, requireGroupAdminPage } from "@/lib/auth";
import { ConfigEditor } from "@/components/config-editor";
import { GroupIconPanel } from "@/components/group-icon-card";
import {
  NotificationAlwaysListPanel,
  NotificationBlacklistPanel,
} from "@/components/notification-blacklist-card";
import { TimeframeBoardPanel } from "@/components/timeframe-board-card";

export const metadata: Metadata = { title: "Group settings" };

type Params = Promise<{ id: string }>;

// Access is gated by the (admin)/groups/[id] layout.
export default async function GroupSettingsPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();
  await requireGroupAdminPage(groupId); // web64a: event managers only reach Events

  const [config, subscription, tiers, user, group, seasonal, blacklist, alwaysList] = await Promise.all([
    api.groupConfig(groupId),
    api.groupSubscription(groupId).catch(() => null),
    api.subscriptionTiers().catch(() => []),
    getUser(),
    // Icon lives on the public profile payload; non-critical for settings.
    api.group(groupId).catch(() => null),
    api.seasonalStatus().catch(() => ({ active: true })),
    // Best-effort: the rest of the settings page must still render if the
    // blacklist read fails, so the panel falls back to an empty list.
    api
      .groupNotificationBlacklist(groupId)
      .catch((): NotificationBlacklist => ({ entries: [], limit: 250 })),
    api
      .groupNotificationAlwaysList(groupId)
      .catch((): NotificationBlacklist => ({ entries: [], limit: 250 })),
  ]);

  // One page, one column of sections: the editor lays out every section —
  // registry-driven or not — so the sidebar, filter box and scroll-spy cover
  // all of them. Editors that aren't config keys are handed in here, already
  // bound to their data, and the editor places them
  // (lib/group-settings-sections.ts says where).
  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        How your group looks, what it announces and where, and what it&apos;s connected to.
        Settings save together — make your changes, then press Save.
      </p>
      <ConfigEditor
        groupId={groupId}
        initial={config}
        subscription={subscription}
        tiers={tiers}
        isSuperadmin={user?.is_superadmin}
        seasonalActive={seasonal.active}
        extras={{
          groupIcon: <GroupIconPanel groupId={groupId} initialIconUrl={group?.icon_url} />,
          blacklist: <NotificationBlacklistPanel groupId={groupId} initial={blacklist} />,
          always: <NotificationAlwaysListPanel groupId={groupId} initial={alwaysList} />,
          timeframeBoard: <TimeframeBoardPanel groupId={groupId} />,
        }}
      />
    </div>
  );
}
