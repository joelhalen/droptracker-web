import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";

export const revalidate = 30;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const player = await api.player(Number(id));
  return {
    title: player.name,
    description: `${player.name} — total loot ${player.total_loot?.value_formatted ?? "?"}, global rank ${player.global_rank ?? "?"}.`,
  };
}

const TYPE_LABEL: Record<string, string> = {
  drop: "Drop",
  clog: "Collection log",
  pb: "Personal best",
  ca: "Combat achievement",
  pet: "Pet",
  level: "Level",
  quest: "Quest",
};

export default async function PlayerPage({ params }: { params: Params }) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isFinite(playerId)) notFound();
  const player = await api.player(playerId);

  // JSON-LD for richer search results (FRONTEND_PLAN.md §15 SEO).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: player.name,
    identifier: player.id,
  };

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-osrs-gold text-3xl font-bold">{player.name}</h1>
          <p className="text-osrs-parchment-dark/80">
            Global rank #{player.global_rank ?? "—"} · {player.points ?? 0} points
          </p>
        </div>
        <div className="text-right">
          <div className="text-osrs-parchment-dark/70 text-xs uppercase tracking-wide">Total loot</div>
          <div className="text-osrs-gold-bright text-2xl font-bold tabular-nums">
            {player.total_loot?.value_formatted ?? "—"}
          </div>
        </div>
      </header>

      <div className="grid gap-8 md:grid-cols-3">
        <section className="md:col-span-2">
          <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Recent submissions</h2>
          <ul className="divide-osrs-bronze/20 divide-y">
            {player.recent_submissions.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  <span className="text-osrs-parchment-dark/60 mr-2 text-xs uppercase">
                    {TYPE_LABEL[s.type] ?? s.type}
                  </span>
                  {s.label}
                </span>
                {s.value && <span className="tabular-nums">{s.value.value_formatted}</span>}
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-6">
          <div>
            <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Groups</h2>
            <ul className="space-y-1 text-sm">
              {player.groups.map((g) => (
                <li key={g.id}>
                  <Link href={`/groups/${g.id}`} className="hover:text-osrs-gold-bright">
                    {g.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {player.top_npc && (
            <div>
              <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Top NPC</h2>
              <p className="text-sm">{player.top_npc}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
