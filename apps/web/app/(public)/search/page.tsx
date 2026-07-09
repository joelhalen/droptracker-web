import type { Metadata } from "next";
import { api } from "@/lib/api";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { SearchBox } from "@/components/search-box";
import { EmptyState, EntityChip } from "@/components/ui";

export const metadata: Metadata = {
  title: "Search",
  description: "Search DropTracker players and clans.",
};

type SearchParams = Promise<{ q?: string }>;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { q = "" } = await searchParams;
  const results = q ? await api.search(q) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-osrs-gold mb-4 text-3xl font-bold">Search</h1>
        <SearchBox initial={q} />
      </div>

      {!results && (
        <p className="text-osrs-parchment-dark/60 text-sm">
          Search for a player or clan by name to see their profile and loot.
        </p>
      )}

      {results && (
        <div className="space-y-8">
          <section>
            <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
              Players
            </h2>
            {results.players.length ? (
              <ul className="divide-osrs-bronze/20 divide-y">
                {results.players.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <EntityHoverCard kind="player" id={p.id} name={p.name} className="min-w-0">
                      <EntityChip
                        href={`/players/${p.id}`}
                        name={p.name}
                        subtitle={p.global_rank != null ? `Global rank #${p.global_rank}` : "Player"}
                      />
                    </EntityHoverCard>
                    {p.total_loot && (
                      <span className="text-osrs-gold-bright shrink-0 tabular-nums">
                        {p.total_loot.value_formatted}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No players found" />
            )}
          </section>

          <section>
            <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Clans</h2>
            {results.groups.length ? (
              <ul className="divide-osrs-bronze/20 divide-y">
                {results.groups.map((g) => (
                  <li key={g.id} className="py-2.5 text-sm">
                    <EntityHoverCard kind="group" id={g.id} name={g.name} className="flex min-w-0">
                      <EntityChip
                        href={`/groups/${g.id}`}
                        name={g.name}
                        flair={g.flair?.style}
                        flairTitle={g.flair?.tier_name}
                        subtitle={
                          g.member_count != null
                            ? `${g.member_count} member${g.member_count === 1 ? "" : "s"}`
                            : "Clan"
                        }
                      />
                    </EntityHoverCard>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No clans found" />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
