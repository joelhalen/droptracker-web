"use client";

/**
 * Wiki drop table for one NPC (`/npcs/[npcId]`), annotated with the player who
 * most recently received each item from this NPC — the modern take on the old
 * XenForo npc_view drop table. Rows arrive common → rare from the API; long
 * tables collapse behind a "Show all" toggle.
 */
import { useState } from "react";
import Link from "next/link";
import { entityPath } from "@/lib/slug";
import type { NpcDropTable } from "@droptracker/api-types";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { Badge, Card, EmptyState } from "@/components/ui";
import { formatRarity, formatRelativeTime } from "@/lib/format";

const COLLAPSED_ROWS = 20;

export function NpcDropTableCard({ table }: { table: NpcDropTable }) {
  const [expanded, setExpanded] = useState(false);

  if (table.items.length === 0) {
    return (
      <Card>
        <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Drop table</h2>
        <EmptyState
          title="No drop table on record"
          hint="We don't have wiki drop data for this NPC yet."
        />
      </Card>
    );
  }

  const rows = expanded ? table.items : table.items.slice(0, COLLAPSED_ROWS);
  const hiddenCount = table.items.length - rows.length;

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-osrs-gold text-lg font-semibold">Drop table</h2>
        <span className="text-osrs-parchment-dark/60 text-xs">
          {table.items.length.toLocaleString()} items · sourced from the OSRS Wiki
        </span>
      </div>

      {table.last_drops_status === "building" && (
        <p className="text-osrs-parchment-dark/60 border-osrs-bronze/30 bg-osrs-surface-2/50 mb-3 rounded border px-3 py-2 text-xs">
          &ldquo;Last received&rdquo; data for this NPC is warming up — it&apos;ll
          appear here in a few minutes.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-osrs-parchment-dark/60 border-osrs-bronze/30 border-b text-left text-xs tracking-wide uppercase">
              <th className="py-2 pr-3 font-medium">Item</th>
              <th className="py-2 pr-3 font-medium">Qty</th>
              <th className="py-2 pr-3 font-medium">Rarity</th>
              <th className="py-2 font-medium">Last received</th>
            </tr>
          </thead>
          <tbody className="divide-osrs-bronze/15 divide-y">
            {rows.map((row) => (
              <tr key={`${row.item_id}-${row.rarity}`}>
                <td className="py-2 pr-3">
                  <Link
                    href={entityPath("items", row.item_id, row.name)}
                    className="hover:text-osrs-gold-bright flex min-w-0 items-center gap-2 font-medium transition-colors"
                  >
                    <img src={row.icon_url} alt="" className="size-6 shrink-0 object-contain" />
                    <span className="truncate">{row.name}</span>
                    {row.noted && (
                      <Badge tone="neutral" title="Dropped as a bank note">
                        noted
                      </Badge>
                    )}
                  </Link>
                </td>
                <td className="text-osrs-parchment-dark/80 py-2 pr-3 whitespace-nowrap">
                  {row.quantity}
                </td>
                <td
                  className="py-2 pr-3 whitespace-nowrap tabular-nums"
                  title={
                    row.rarity < 1 ? `${(row.rarity * 100).toPrecision(3)}% per roll` : undefined
                  }
                >
                  <span className={row.rarity >= 1 ? "text-osrs-green" : rarityClass(row.rarity)}>
                    {formatRarity(row.rarity)}
                  </span>
                  {row.rolls > 1 && (
                    <span className="text-osrs-parchment-dark/50 ml-1 text-xs">×{row.rolls}</span>
                  )}
                </td>
                <td className="py-2">
                  {row.last_drop ? (
                    <span className="flex min-w-0 items-center gap-1.5 text-xs">
                      <EntityHoverCard
                        kind="player"
                        id={row.last_drop.player_id}
                        name={row.last_drop.player_name}
                        className="min-w-0 truncate"
                      >
                        <Link
                          href={entityPath("players", row.last_drop.player_id, row.last_drop.player_name)}
                          className="hover:text-osrs-gold-bright truncate font-medium transition-colors"
                        >
                          {row.last_drop.player_name}
                        </Link>
                      </EntityHoverCard>
                      <span className="text-osrs-parchment-dark/50 shrink-0">
                        {formatRelativeTime(row.last_drop.ts)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-osrs-parchment-dark/40 text-xs">
                      {table.last_drops_status === "building" ? "…" : "Never tracked"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-osrs-gold-bright hover:text-osrs-gold mt-3 text-sm font-medium transition-colors"
        >
          Show all {table.items.length.toLocaleString()} items ↓
        </button>
      )}
      {expanded && table.items.length > COLLAPSED_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-osrs-parchment-dark/60 hover:text-osrs-gold mt-3 ml-4 text-sm transition-colors"
        >
          Collapse
        </button>
      )}
    </Card>
  );
}

/** Rarer → warmer highlight, mirroring the lootboard value colors. */
function rarityClass(rarity: number): string {
  if (rarity <= 1 / 5000) return "text-osrs-gold-bright";
  if (rarity <= 1 / 512) return "text-purple-300";
  if (rarity <= 1 / 64) return "text-sky-300";
  return "text-osrs-parchment-dark/80";
}
