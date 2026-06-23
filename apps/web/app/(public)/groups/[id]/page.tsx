import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";

export const revalidate = 30;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const group = await api.group(Number(id));
  return {
    title: group.name,
    description: group.description ?? `${group.name} — ${group.member_count} members.`,
  };
}

export default async function GroupPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();
  const group = await api.group(groupId);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-osrs-gold text-3xl font-bold">{group.name}</h1>
          {group.description && (
            <p className="text-osrs-parchment-dark/80 max-w-2xl">{group.description}</p>
          )}
        </div>
        {group.discord_url && (
          <a
            href={group.discord_url}
            className="bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium"
          >
            Join Discord
          </a>
        )}
      </header>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Members" value={String(group.member_count)} />
        <Stat label="Global rank" value={`#${group.global_rank ?? "—"}`} />
        <Stat label="Monthly loot" value={group.monthly_loot?.value_formatted ?? "—"} />
        <Stat
          label="Top player"
          value={group.top_player?.name ?? "—"}
          href={group.top_player ? (`/players/${group.top_player.id}` as Route) : undefined}
        />
      </dl>

      <section>
        <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Recent submissions</h2>
        <ul className="divide-osrs-bronze/20 divide-y">
          {group.recent_submissions.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
              <span>{s.label}</span>
              {s.value && <span className="tabular-nums">{s.value.value_formatted}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: string; href?: Route }) {
  const inner = <span className="text-osrs-gold-bright text-xl font-bold">{value}</span>;
  return (
    <div className="border-osrs-bronze/20 rounded border p-3">
      <dt className="text-osrs-parchment-dark/70 text-xs uppercase tracking-wide">{label}</dt>
      <dd>{href ? <Link href={href}>{inner}</Link> : inner}</dd>
    </div>
  );
}
