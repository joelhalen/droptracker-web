import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { api } from "@/lib/api";
import { requireUser, canAdminGroup, canManageEvents } from "@/lib/auth";
import { hasEntitlement } from "@/lib/entitlements";
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

  // Signing in always suffices for the 401 side (an actual group admin just
  // needs their session), so requireUser's straight-to-OAuth redirect stays;
  // a signed-in non-admin gets the 403 interrupt page (web57a) — which links
  // back to the group's public profile — instead of a silent bounce there.
  const user = await requireUser(`/groups/${groupId}/admin`);
  // web64a: full group admins reach every tab; event managers reach ONLY the
  // Events subtree. Every non-events admin page re-gates on canAdminGroup (and
  // the backend independently enforces both), so admitting a manager here can
  // never expose a group-admin action.
  const isAdmin = canAdminGroup(user, groupId);
  if (!isAdmin && !canManageEvents(user, groupId)) forbidden();

  const group = await api.group(groupId);
  // Tier badge in the admin header — makes the group's plan visible from every
  // admin tab. Best-effort: header still renders if the billing API is down.
  // The manual-review pending count drives the Submissions tab badge (small
  // payload; best-effort so a hiccup never blocks the shell).
  const [subscription, tiers, manualQueue] = await Promise.all([
    api.groupSubscription(groupId).catch(() => null),
    api.subscriptionTiers().catch(() => []),
    api.manualSubmissions(groupId).catch(() => null),
  ]);

  const eventsTab: NavTab = {
    href: `/groups/${groupId}/events`,
    label: "Events",
    matchPrefix: true,
    locked: !hasEntitlement(subscription, "events", { isSuperadmin: user.is_superadmin }),
  };

  // A pure event manager (not a full admin) only ever sees the Events tab; the
  // group-admin tabs are hidden and their pages 403.
  const tabs: NavTab[] = isAdmin
    ? [
        { href: `/groups/${groupId}/admin`, label: "Overview" },
        { href: `/groups/${groupId}/settings`, label: "Settings" },
        {
          href: `/groups/${groupId}/embeds`,
          label: "Embeds",
          locked: !hasEntitlement(subscription, "custom_embeds", { isSuperadmin: user.is_superadmin }),
        },
        { href: `/groups/${groupId}/announcements`, label: "Announcements" },
        { href: `/groups/${groupId}/members`, label: "Members" },
        {
          href: `/groups/${groupId}/submissions`,
          label: "Submissions",
          badge: manualQueue?.pending_count ?? 0,
        },
        { href: `/groups/${groupId}/authorized`, label: "Authorized users" },
        { href: `/groups/${groupId}/event-managers`, label: "Event managers" },
        eventsTab,
        {
          // /points/manage, not /points: the XF-era /groups/:id/points URL was
          // permanently redirected (308) to the profile until 2026-07-08, and
          // browsers cache permanent redirects — a tab pointing at /points would
          // silently bounce those visitors back to the profile forever.
          href: `/groups/${groupId}/points/manage`,
          label: "Points",
          locked: !hasEntitlement(subscription, "custom_points", { isSuperadmin: user.is_superadmin }),
        },
        { href: `/groups/${groupId}/subscription`, label: "Subscription" },
        { href: `/groups/${groupId}/diagnostics`, label: "Diagnostics" },
      ]
    : [eventsTab];

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
