"use client";

import { useMemo, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import type { PbBossSummary } from "@droptracker/api-types";
import { Card, EmptyState, fieldInputClass } from "@/components/ui";

const IMG_BASE = "https://www.droptracker.io/img";

function BossCard({ boss }: { boss: PbBossSummary }) {
  return (
    <Link href={`/personal-bests/${boss.npc_id}` as Route} className="group block min-w-0">
      <Card padding="p-4" className="hover:border-osrs-gold/40 h-full transition-colors">
        <div className="flex items-center gap-2.5">
          <img
            src={`${IMG_BASE}/npcdb/${boss.npc_id}.png`}
            alt=""
            className="size-9 shrink-0 rounded object-contain"
            loading="lazy"
          />
          <div className="min-w-0">
            <div
              className="group-hover:text-osrs-gold-bright truncate text-sm font-semibold transition-colors"
              title={boss.name}
            >
              {boss.name}
            </div>
            <div className="text-osrs-parchment-dark/60 text-xs">
              {boss.player_count.toLocaleString()} ranked · {boss.team_sizes.length}{" "}
              {boss.team_sizes.length === 1 ? "board" : "boards"}
            </div>
          </div>
        </div>
        {boss.best && (
          <div className="text-osrs-parchment-dark/70 mt-2 flex items-baseline justify-between gap-2 text-xs">
            <span className="min-w-0 truncate">
              Record by <span className="text-osrs-parchment font-medium">{boss.best.player_name}</span>
            </span>
            <span className="text-osrs-gold-bright shrink-0 font-mono font-bold tabular-nums">
              {boss.best.time_display}
            </span>
          </div>
        )}
      </Card>
    </Link>
  );
}

/** Searchable boss index for the global personal-best leaderboards. */
export function PbBossGrid({ bosses }: { bosses: PbBossSummary[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bosses;
    return bosses.filter((b) => b.name.toLowerCase().includes(q));
  }, [bosses, query]);

  const featured = filtered.filter((b) => b.featured);
  const rest = filtered.filter((b) => !b.featured);

  return (
    <div className="space-y-8">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search bosses…"
        aria-label="Search bosses"
        className={`${fieldInputClass} w-full max-w-sm`}
      />

      {filtered.length === 0 && (
        <EmptyState title="No bosses match" hint="Try a different search term." />
      )}

      {featured.length > 0 && (
        <section aria-labelledby="pb-raids-heading">
          <h2 id="pb-raids-heading" className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
            Raids
          </h2>
          <div className="stagger-children grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((b) => (
              <BossCard key={b.npc_id} boss={b} />
            ))}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section aria-labelledby="pb-bosses-heading">
          <h2 id="pb-bosses-heading" className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
            All bosses
          </h2>
          <div className="stagger-children grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rest.map((b) => (
              <BossCard key={b.npc_id} boss={b} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
