import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { api } from "@/lib/api";
import { requireUser, canAdminGroup } from "@/lib/auth";
import { TabNav, type NavTab } from "@/components/tab-nav";
import { NameTile, SubscriptionStatusBadge, TierBadge } from "@/components/ui";

type Params = Promise<{ id: string }>;

/**
 * Admin shell for /groups/[id]/*. Gates access (owner/admin only) once and
 * renders the group header + admin tabs for all child pages.
 */
export default async function GroupAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  const user = await requireUser(`/groups/${groupId}/admin`);
  if (!canAdminGroup(user, groupId)) redirect(`/groups/${groupId}`);

  const group = await api.group(groupId);
  // Tier badge in the admin header — makes the group's plan visible from every
  // admin tab. Best-effort: header still renders if the billing API is down.
  const [subscription, tiers] = await Promise.all([
    api.groupSubscription(groupId).catch(() => null),
    api.subscriptionTiers().catch(() => []),
  ]);

  const tabs: NavTab[] = [
    { href: `/groups/${groupId}/admin`, label: "Overview" },
    { href: `/groups/${groupId}/settings`, label: "Settings" },
    { href: `/groups/${groupId}/announcements`, label: "Announcements" },
    { href: `/groups/${groupId}/members`, label: "Members" },
    // Events owns a nested [eventId] detail route — stay active there too.
    { href: `/groups/${groupId}/events`, label: "Events", matchPrefix: true },
    { href: `/groups/${groupId}/subscription`, label: "Subscription" },
    { href: `/groups/${groupId}/diagnostics`, label: "Diagnostics" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <Link
          href={`/groups/${groupId}`}
          className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
        >
          ← {group.name}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <NameTile name={group.name} />
          <h1 className="text-osrs-gold text-2xl font-bold">Manage {group.name}</h1>
          {subscription && (
            <span className="flex items-center gap-1.5">
              <TierBadge
                tierKey={subscription.tier_key}
                name={tiers.find((t) => t.key === subscription.tier_key)?.name}
              />
              {subscription.status !== "none" && subscription.status !== "active" && (
                <SubscriptionStatusBadge status={subscription.status} />
              )}
            </span>
          )}
        </div>
        <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
          {group.member_count} member{group.member_count === 1 ? "" : "s"}
          {group.global_rank != null && <> · Global rank #{group.global_rank}</>}
        </p>
      </header>

      <TabNav tabs={tabs} />

      <div>{children}</div>
    </div>
  );
}
