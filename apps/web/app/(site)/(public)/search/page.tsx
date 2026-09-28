import type { Metadata, Route } from "next";
import Link from "next/link";
import type { SearchEntity } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { docHitHref } from "@/lib/docs";
import { entityPath } from "@/lib/slug";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { EntitySearch } from "@/components/entity-search";
import { EmptyState, EntityChip } from "@/components/ui";

export const metadata: Metadata = {
  title: "Search",
  description: "Search DropTracker players, clans, bosses, items and docs.",
};

/** NPC/item hits — plain icon+name rows linking to their pages. */
function EntityResultList({
  entities,
  hrefBase,
  emptyTitle,
}: {
  entities: SearchEntity[];
  hrefBase: "npcs" | "items";
  emptyTitle: string;
}) {
  if (!entities.length) return <EmptyState title={emptyTitle} />;
  return (
    <ul className="divide-osrs-bronze/20 divide-y">
      {entities.map((e) => (
        <li key={e.id} className="py-2.5 text-sm">
          <Link
            href={`/${hrefBase}/${e.id}` as Route}
            className="hover:text-osrs-gold-bright flex min-w-0 items-center gap-2.5 font-medium transition-colors"
          >
            <img
              src={e.icon_url}
              alt=""
              className="size-7 shrink-0 object-contain"
              loading="lazy"
            />
            <span className="truncate">{e.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

type SearchParams = Promise<{ q?: string }>;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { q = "" } = await searchParams;
  const [results, docs] = q
    ? await Promise.all([api.search(q), api.searchDocs(q, 8).catch(() => [])])
    : [null, []];

  // Sections with hits first (stable), so a topic search that only matches
  // the docs doesn't open on four "not found" blocks.
  const sections = results
    ? [
        {
          has: results.players.length > 0,
          node: (
            <section key="players">
              <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
                Players
              </h2>
              {results.players.length ? (
                <ul className="divide-osrs-bronze/20 divide-y">
                  {results.players.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <EntityHoverCard kind="player" id={p.id} name={p.name} className="min-w-0">
                        <EntityChip
                          href={entityPath("players", p.id, p.name)}
                          name={p.name}
                          subtitle={
                            p.global_rank != null ? `Global rank #${p.global_rank}` : "Player"
                          }
                          playerId={p.id}
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
          ),
        },
        {
          has: results.groups.length > 0,
          node: (
            <section key="groups">
              <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Clans</h2>
              {results.groups.length ? (
                <ul className="divide-osrs-bronze/20 divide-y">
                  {results.groups.map((g) => (
                    <li key={g.id} className="py-2.5 text-sm">
                      <EntityHoverCard
                        kind="group"
                        id={g.id}
                        name={g.name}
                        className="flex min-w-0"
                      >
                        <EntityChip
                          href={entityPath("groups", g.id, g.name)}
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
          ),
        },
        {
          has: results.npcs.length > 0,
          node: (
            <section key="npcs">
              <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
                Bosses
              </h2>
              <EntityResultList
                entities={results.npcs}
                hrefBase="npcs"
                emptyTitle="No bosses found"
              />
            </section>
          ),
        },
        {
          has: results.items.length > 0,
          node: (
            <section key="items">
              <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Items</h2>
              <EntityResultList
                entities={results.items}
                hrefBase="items"
                emptyTitle="No items found"
              />
            </section>
          ),
        },
        {
          has: docs.length > 0,
          node: (
            <section key="docs">
              <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Docs</h2>
              {docs.length ? (
                <ul className="divide-osrs-bronze/20 divide-y">
                  {docs.map((d) => (
                    <li key={d.slug} className="py-2.5 text-sm">
                      <Link
                        href={docHitHref(d) as Route}
                        className="hover:text-osrs-gold-bright font-medium transition-colors"
                      >
                        {d.title}
                        {d.section && (
                          <span className="text-osrs-parchment-dark/60 font-normal">
                            {" "}
                            › {d.section}
                          </span>
                        )}
                      </Link>
                      {d.snippet && (
                        <p className="text-osrs-parchment-dark/60 mt-0.5 line-clamp-2 text-xs">
                          {d.snippet}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No docs found" />
              )}
            </section>
          ),
        },
      ].sort((a, b) => Number(b.has) - Number(a.has))
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-osrs-gold mb-4 text-3xl font-bold">Search</h1>
        {/* Live typeahead popup while typing; Enter / the button re-render the
            full result sections below. Keyed on q so a popup navigation to
            /search?q=… resets the field to the submitted query. */}
        <EntitySearch key={q} initial={q} withButton includeDocs />
      </div>

      {!results && (
        <p className="text-osrs-parchment-dark/60 text-sm">
          Search players, clans, bosses and items by name, or the docs for a topic.
        </p>
      )}

      {results && <div className="space-y-8">{sections.map((sec) => sec.node)}</div>}
    </div>
  );
}
