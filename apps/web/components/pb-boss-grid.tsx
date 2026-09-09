"use client";

/**
 * Searchable boss index for the global personal-best leaderboards.
 *
 * Each card names the boss's overall record holder, and — when that time has
 * a captured loadout — can open their gear, inventory and character right
 * here, without the detour through the boss page. The card is therefore not
 * one big link any more: the boss identity links through, the record line
 * carries the toggle, and the panel sits under both. One card open at a time
 * across the whole grid; an open card widens to two columns so the panel's
 * three blocks fit on one row instead of stacking.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { entityPath } from "@/lib/slug";
import type { PbBossSummary } from "@droptracker/api-types";
import { PbLoadout } from "@/components/pb-loadout";
import { Card, EmptyState, Input } from "@/components/ui";

const IMG_BASE = "https://www.droptracker.io/img";

function BossCard({
  boss,
  open,
  stretch,
  onToggle,
}: {
  boss: PbBossSummary;
  open: boolean;
  /** Fill the grid row. Off while any card is open, so its neighbours keep
   * their natural height instead of stretching into empty boxes beside it. */
  stretch: boolean;
  onToggle: () => void;
}) {
  const record = boss.best;
  const gearId = record?.has_loadout && record.pb_id != null ? record.pb_id : null;
  const showPanel = open && gearId != null;
  return (
    <Card
      padding="p-4"
      className={`min-w-0 transition-colors ${stretch ? "h-full" : ""} ${
        showPanel ? "border-osrs-gold/40 sm:col-span-2" : "hover:border-osrs-gold/40"
      }`}
    >
      <Link href={entityPath("npcs", boss.npc_id, boss.name)} className="group block min-w-0">
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
      </Link>
      {record && (
        <div className="text-osrs-parchment-dark/70 mt-2 flex items-baseline justify-between gap-2 text-xs">
          <span className="min-w-0 truncate">
            Record by{" "}
            <Link
              href={entityPath("players", record.player_id, record.player_name)}
              className="text-osrs-parchment hover:text-osrs-gold-bright font-medium transition-colors"
            >
              {record.player_name}
            </Link>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="text-osrs-gold-bright font-mono font-bold tabular-nums">
              {record.time_display}
            </span>
            {gearId != null && (
              <button
                type="button"
                aria-expanded={showPanel}
                aria-controls={`pb-index-gear-${gearId}`}
                onClick={onToggle}
                title={
                  showPanel
                    ? "Hide the gear worn for this record"
                    : "Show the gear worn for this record"
                }
                className={`rounded px-1 text-[11px] whitespace-nowrap transition-colors ${
                  showPanel
                    ? "text-osrs-gold-bright"
                    : "text-osrs-parchment-dark/50 hover:text-osrs-gold-bright"
                }`}
              >
                Gear {showPanel ? "▴" : "▾"}
              </button>
            )}
          </span>
        </div>
      )}
      {showPanel && (
        <div id={`pb-index-gear-${gearId}`} className="border-osrs-bronze/20 mt-3 border-t pt-3">
          <div className="text-osrs-parchment-dark/60 mb-2 text-xs">
            {record!.team_size === "Solo" ? "Solo" : `${record!.team_size} players`} record ·{" "}
            <Link
              href={entityPath("npcs", boss.npc_id, boss.name)}
              className="hover:text-osrs-gold-bright underline-offset-2 hover:underline"
            >
              full boards →
            </Link>
          </div>
          <PbLoadout pbId={gearId} />
        </div>
      )}
    </Card>
  );
}

/** Searchable boss index for the global personal-best leaderboards. */
export function PbBossGrid({ bosses }: { bosses: PbBossSummary[] }) {
  const [query, setQuery] = useState("");
  // Which boss has its record holder's gear open. One at a time: the panel
  // is large, and a grid with several open stops being an index.
  const [openNpc, setOpenNpc] = useState<number | null>(null);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bosses;
    return bosses.filter((b) => b.name.toLowerCase().includes(q));
  }, [bosses, query]);

  const featured = filtered.filter((b) => b.featured);
  const rest = filtered.filter((b) => !b.featured);

  const anyOpen = openNpc != null;
  const card = (b: PbBossSummary) => (
    <BossCard
      key={b.npc_id}
      boss={b}
      open={openNpc === b.npc_id}
      stretch={!anyOpen}
      onToggle={() => setOpenNpc((cur) => (cur === b.npc_id ? null : b.npc_id))}
    />
  );
  // Rows normally stretch so a row of cards lines up; with a panel open the
  // row is as tall as the panel, and stretching would blow the others up.
  const gridClass = `stagger-children grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${
    anyOpen ? "items-start" : ""
  }`;

  return (
    <div className="space-y-8">
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search bosses…"
        aria-label="Search bosses"
        className="w-full max-w-sm"
      />

      {filtered.length === 0 && (
        <EmptyState title="No bosses match" hint="Try a different search term." />
      )}

      {featured.length > 0 && (
        <section aria-labelledby="pb-raids-heading">
          <h2 id="pb-raids-heading" className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
            Raids
          </h2>
          <div className={gridClass}>{featured.map(card)}</div>
        </section>
      )}

      {rest.length > 0 && (
        <section aria-labelledby="pb-bosses-heading">
          <h2 id="pb-bosses-heading" className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
            All bosses
          </h2>
          <div className={gridClass}>{rest.map(card)}</div>
        </section>
      )}
    </div>
  );
}
