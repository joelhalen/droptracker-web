import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { api } from "@/lib/api";
import { requireUser, canAdminGroup } from "@/lib/auth";

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

  const tabs: { href: Route; label: string }[] = [
    { href: `/groups/${groupId}/admin` as Route, label: "Overview" },
    { href: `/groups/${groupId}/settings` as Route, label: "Settings" },
    { href: `/groups/${groupId}/announcements` as Route, label: "Announcements" },
    { href: `/groups/${groupId}/members` as Route, label: "Members" },
    { href: `/groups/${groupId}/events` as Route, label: "Events" },
    { href: `/groups/${groupId}/subscription` as Route, label: "Subscription" },
    { href: `/groups/${groupId}/diagnostics` as Route, label: "Diagnostics" },
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

      <nav className="border-osrs-bronze/30 flex flex-wrap gap-1 border-b pb-2 text-sm">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className="hover:bg-osrs-bronze/30 rounded px-3 py-1.5">
            {t.label}
          </Link>
        ))}
      </nav>

      <div>{children}</div>
    </div>
  );
}
