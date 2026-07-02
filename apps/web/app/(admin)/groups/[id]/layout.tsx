import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { api } from "@/lib/api";
import { requireUser, canAdminGroup } from "@/lib/auth";
import { TabNav, type NavTab } from "@/components/tab-nav";

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
        <h1 className="text-osrs-gold mt-1 text-2xl font-bold">Manage {group.name}</h1>
      </header>

      <TabNav tabs={tabs} />

      <div>{children}</div>
    </div>
  );
}
