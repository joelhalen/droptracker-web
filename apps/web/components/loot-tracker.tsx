"use client";

/**
 * RuneLite-style loot tracker for player profile pages: one box per NPC with
 * kill count + total GP in the header and a grid of stacked item icons below,
 * exactly like the in-game plugin panel (ported from the old XenForo
 * `player_drops` template). Server renders the current month; switching
 * months fetches through the BFF (`/api/players/[id]/loot`).
 */

import { useRef, useState } from "react";
import type { LootTrackerNpc, PlayerLootTracker } from "@droptracker/api-types";
import { Card, EmptyState } from "@/components/ui";
import { formatGp } from "@/lib/format";

const IMG_BASE = "https://www.droptracker.io/img";
const INITIAL_BOXES = 12;

function currentPartition(): number {
  const now = new Date();
  return now.getFullYear() * 100 + now.getMonth() + 1;
}

function shiftPartition(partition: number, delta: 1 | -1): number {
  let year = Math.floor(partition / 100);
  let month = (partition % 100) + delta;
  if (month > 12) [year, month] = [year + 1, 1];
  if (month < 1) [year, month] = [year - 1, 12];
  return year * 100 + month;
}

function partitionLabel(partition: number): string {
  const date = new Date(Math.floor(partition / 100), (partition % 100) - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function NpcBox({ npc }: { npc: LootTrackerNpc }) {
  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="border-osrs-bronze/25 bg-osrs-surface-2/70 flex items-baseline gap-2 border-b px-3 py-2">
        <span className="truncate text-sm font-medium" title={npc.name}>
          {npc.name}
        </span>
        <span className="text-osrs-parchment-dark/60 shrink-0 text-xs tabular-nums">
          × {npc.kills.toLocaleString()}
        </span>
        <span className="text-osrs-gold-bright ml-auto shrink-0 text-xs font-semibold tabular-nums">
          {npc.loot.value_formatted}
        </span>
      </div>
      <div className="grid grid-cols-5">
        {npc.items.map((item) => (
          <div
            key={item.item_id}
            className="border-osrs-bronze/15 relative flex aspect-square items-center justify-center border-r border-b p-1"
            title={`${item.name}${item.quantity > 1 ? ` × ${item.quantity.toLocaleString()}` : ""} (${item.loot.value_formatted} gp)`}
          >
            {item.quantity > 1 && (
              <span className="absolute top-0.5 left-0.5 z-10 rounded-sm bg-black/70 px-0.5 text-[10px] leading-tight font-bold text-yellow-300">
                {formatGp(item.quantity)}
              </span>
            )}
            <img
              src={`${IMG_BASE}/itemdb/${item.item_id}.png`}
              alt={item.name}
              loading="lazy"
              className="max-h-full max-w-full object-contain [image-rendering:pixelated]"
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function LootTracker({ playerId, initial }: { playerId: number; initial: PlayerLootTracker }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // Months already fetched this visit — switching back is instant.
  const cache = useRef(new Map<number, PlayerLootTracker>([[initial.partition, initial]]));

  const atNewest = data.partition >= currentPartition();
  const atOldest = data.partition <= data.earliest_partition;

  async function switchMonth(delta: 1 | -1) {
    const target = shiftPartition(data.partition, delta);
    setShowAll(false);
    setError(false);
    const cached = cache.current.get(target);
    if (cached) {
      setData(cached);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/players/${playerId}/loot?partition=${target}`);
      if (!res.ok) throw new Error(`loot fetch ${res.status}`);
      const payload = (await res.json()) as PlayerLootTracker;
      cache.current.set(target, payload);
      setData(payload);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const monthTotal = data.npcs.reduce((sum, npc) => sum + npc.loot.value, 0);
  const visible = showAll ? data.npcs : data.npcs.slice(0, INITIAL_BOXES);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="border-osrs-bronze/40 flex items-center rounded border">
          <button
            type="button"
            onClick={() => switchMonth(-1)}
            disabled={loading || atOldest}
            aria-label="Previous month"
            className="hover:bg-osrs-bronze/30 px-2.5 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-30"
          >
            ‹
          </button>
          <span className="border-osrs-bronze/40 min-w-32 border-x px-3 py-1 text-center text-sm font-medium">
            {partitionLabel(data.partition)}
          </span>
          <button
            type="button"
            onClick={() => switchMonth(1)}
            disabled={loading || atNewest}
            aria-label="Next month"
            className="hover:bg-osrs-bronze/30 px-2.5 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-30"
          >
            ›
          </button>
        </div>
        {data.npcs.length > 0 && (
          <span className="text-osrs-parchment-dark/60 text-sm">
            {data.npcs.length.toLocaleString()} NPCs •{" "}
            <span className="text-osrs-gold-bright font-semibold">{formatGp(monthTotal)} gp</span>
          </span>
        )}
        {error && <span className="text-sm text-red-400">Couldn’t load that month — try again.</span>}
      </div>

      {data.npcs.length === 0 ? (
        <EmptyState
          title={`No tracked loot in ${partitionLabel(data.partition)}`}
          hint="Drops submitted with the DropTracker plugin will appear here."
        />
      ) : (
        <>
          <div
            className={`stagger-children grid items-start gap-3 transition-opacity sm:grid-cols-2 lg:grid-cols-3 ${loading ? "pointer-events-none opacity-50" : ""}`}
          >
            {visible.map((npc) => (
              <NpcBox key={npc.npc_id} npc={npc} />
            ))}
          </div>
          {data.npcs.length > INITIAL_BOXES && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 mt-4 rounded border px-3 py-1.5 text-sm font-medium"
            >
              {showAll ? "Show fewer" : `Show all ${data.npcs.length.toLocaleString()} NPCs`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
