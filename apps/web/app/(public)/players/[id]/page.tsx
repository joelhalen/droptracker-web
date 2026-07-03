import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { SubmissionList } from "@/components/submission-list";
import { EntityChip, NameTile, StatTile } from "@/components/ui";

export const revalidate = 30;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  try {
    const player = await api.player(Number(id));
    return {
      title: player.name,
      description: `${player.name} — total loot ${player.total_loot?.value_formatted ?? "?"}, global rank ${player.global_rank ?? "?"}.`,
    };
  } catch {
    return { title: "Player" };
  }
}

export default async function PlayerPage({ params }: { params: Params }) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isFinite(playerId)) notFound();
  const player = await orNotFound(api.player(playerId));

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

      <header className="space-y-5">
        <div className="flex items-center gap-4">
          <NameTile name={player.name} size="lg" />
          <div>
            <h1 className="text-osrs-gold text-3xl font-bold">{player.name}</h1>
            <p className="text-osrs-parchment-dark/80 text-sm">Old School RuneScape player</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total loot" value={player.total_loot?.value_formatted ?? "—"} />
          <StatTile
            label="Global rank"
            value={player.global_rank != null ? `#${player.global_rank}` : "—"}
          />
          <StatTile label="Points" value={(player.points ?? 0).toLocaleString()} />
          <StatTile label="Top NPC" value={player.top_npc ?? "—"} />
        </div>
      </header>

      <div className="grid gap-8 md:grid-cols-3">
        <section className="md:col-span-2">
          <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Recent submissions</h2>
          <SubmissionList submissions={player.recent_submissions} />
        </section>

        <aside className="space-y-6">
          <div>
            <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Groups</h2>
            {player.groups.length ? (
              <ul className="space-y-2.5 text-sm">
                {player.groups.map((g) => (
                  <li key={g.id}>
                    <EntityChip href={`/groups/${g.id}`} name={g.name} size="sm" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-osrs-parchment-dark/60 text-sm">Not in any groups.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
