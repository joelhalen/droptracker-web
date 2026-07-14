import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";

export const metadata: Metadata = { title: "Group admin" };

type Params = Promise<{ id: string }>;

const CARDS = [
  { slug: "settings", title: "Settings", desc: "Notifications, lootboard, points, integrations." },
  { slug: "announcements", title: "Announcements", desc: "Post news and syndicate to Discord." },
  { slug: "members", title: "Members", desc: "WOM sync, hide/unhide players." },
  { slug: "events", title: "Events", desc: "Create events, tasks, teams, and bingo." },
  { slug: "subscription", title: "Subscription", desc: "Manage the group's recurring plan." },
  { slug: "diagnostics", title: "Diagnostics", desc: "Pipeline heartbeat and recent activity." },
] as const;

export default async function GroupAdminOverview({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  const group = await api.group(groupId);

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Members" value={String(group.member_count)} />
        <Stat label="Global rank" value={`#${group.global_rank ?? "—"}`} />
        <Stat label="Monthly loot" value={group.monthly_loot?.value_formatted ?? "—"} />
      </dl>

      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link
            key={c.slug}
            href={`/groups/${groupId}/${c.slug}` as Route}
            className="border-osrs-bronze/20 hover:border-osrs-gold/50 rounded border p-4 transition-colors"
          >
            <div className="text-osrs-gold-bright font-medium">{c.title}</div>
            <div className="text-osrs-parchment-dark/70 mt-1 text-sm">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-osrs-bronze/20 rounded border p-3">
      <dt className="text-osrs-parchment-dark/70 text-xs uppercase tracking-wide">{label}</dt>
      <dd className="text-osrs-gold-bright text-xl font-bold">{value}</dd>
    </div>
  );
}
