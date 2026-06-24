import type { Metadata, Route } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { SearchBox } from "@/components/search-box";

export const metadata: Metadata = { title: "Lookup" };

type SearchParams = Promise<{ q?: string }>;

const CATEGORY_LABELS: Record<string, string> = {
  player: "Player",
  group: "Group",
  drop: "Drop",
  clog: "Collection log",
  pb: "Personal best",
  ca: "Combat achievement",
  pet: "Pet",
  item: "Item",
  npc: "NPC",
};

export default async function AdminLookupPage({ searchParams }: { searchParams: SearchParams }) {
  const { q = "" } = await searchParams;
  const data = q ? await api.adminLookup(q) : null;

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-osrs-parchment-dark/70 text-sm">
        Cross-content search across players, groups, drops, collection logs, PBs, CAs, pets, items,
        and NPCs.
      </p>
      <SearchBox initial={q} basePath="/admin/lookup" placeholder="Search anything…" />

      {data && (
        <ul className="divide-osrs-bronze/20 divide-y">
          {data.results.map((r) => {
            const inner = (
              <div className="flex items-center justify-between py-2.5">
                <span>
                  <span className="text-osrs-parchment-dark/50 mr-2 text-xs uppercase">
                    {CATEGORY_LABELS[r.category] ?? r.category}
                  </span>
                  {r.label}
                </span>
                {r.detail && <span className="text-osrs-parchment-dark/60 text-sm">{r.detail}</span>}
              </div>
            );
            return (
              <li key={`${r.category}:${r.id}`}>
                {r.href ? (
                  <Link href={r.href as Route} className="hover:text-osrs-gold-bright block">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
          {data.results.length === 0 && (
            <li className="text-osrs-parchment-dark/60 py-2.5 text-sm">No results.</li>
          )}
        </ul>
      )}
    </div>
  );
}
