import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { SearchBox } from "@/components/search-box";

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

      {results && (
        <div className="space-y-8">
          <section>
            <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
              Players
            </h2>
            {results.players.length ? (
              <ul className="divide-osrs-bronze/20 divide-y">
                {results.players.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                    <Link href={`/players/${p.id}`} className="hover:text-osrs-gold-bright">
                      {p.name}
                    </Link>
                    <span className="text-osrs-parchment-dark/70 tabular-nums">
                      {p.total_loot?.value_formatted ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-osrs-parchment-dark/60 text-sm">No players found.</p>
            )}
          </section>

          <section>
            <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Clans</h2>
            {results.groups.length ? (
              <ul className="divide-osrs-bronze/20 divide-y">
                {results.groups.map((g) => (
                  <li key={g.id} className="flex items-center justify-between py-2.5 text-sm">
                    <Link href={`/groups/${g.id}`} className="hover:text-osrs-gold-bright">
                      {g.name}
                    </Link>
                    {g.member_count != null && (
                      <span className="text-osrs-parchment-dark/70">{g.member_count} members</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-osrs-parchment-dark/60 text-sm">No clans found.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
