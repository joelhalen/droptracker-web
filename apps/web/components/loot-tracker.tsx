"use client";

/**
 * RuneLite-style loot tracker for player profile pages: one box per NPC with
 * kill count + total GP in the header and a grid of stacked item icons below,
 * exactly like the in-game plugin panel (ported from the old XenForo
 * `player_drops` template). Server renders the current month; switching months
 * — and the all-time view, which spans the life of the account — fetches
 * through the BFF (`/api/players/[id]/loot`).
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { entityPath } from "@/lib/slug";
import {
  LOOT_ALL_TIME,
  type LootPeriod,
  type LootTrackerItem,
  type LootTrackerNpc,
  type PlayerLootTracker,
} from "@droptracker/api-types";
import { CARD_SECTION_CLASS, CardStatLine, HoverCard } from "@/components/hover-card";
import { Card, EmptyState } from "@/components/ui";
import { formatGp, formatRelativeTime } from "@/lib/format";

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

/** What the header reads for whichever period is on screen. */
function periodLabel(data: PlayerLootTracker): string {
  return data.all_time ? "All time" : partitionLabel(data.partition);
}

/** Rich item tooltip: share of the NPC's period, avg per drop, first/last seen —
 * replaces the browser-default `title` attribute the grid used to rely on. */
function ItemCardContent({ item, npc }: { item: LootTrackerItem; npc: LootTrackerNpc }) {
  const unit = item.quantity > 1 ? Math.floor(item.loot.value / item.quantity) : null;
  const share = npc.loot.value > 0 ? (item.loot.value / npc.loot.value) * 100 : null;
  return (
    <div className="p-3">
      <div className="flex items-center gap-2.5">
        <span className="bg-osrs-surface-3/60 flex size-9 shrink-0 items-center justify-center rounded">
          <img
            src={`${IMG_BASE}/itemdb/${item.item_id}.png`}
            alt=""
            className="max-h-7 max-w-7 object-contain [image-rendering:pixelated]"
          />
        </span>
        <div className="min-w-0">
          <Link
            href={entityPath("items", item.item_id, item.name)}
            className="hover:text-osrs-gold-bright block truncate font-semibold transition-colors"
          >
            {item.name}
          </Link>
          <div className="text-osrs-parchment-dark/60 text-xs">from {npc.name}</div>
        </div>
      </div>
      <div className={`${CARD_SECTION_CLASS} space-y-1`}>
        <CardStatLine label="Quantity" value={`× ${item.quantity.toLocaleString()}`} />
        <CardStatLine
          label="Total value"
          value={
            <span className="text-osrs-gold-bright">{item.loot.value_formatted} gp</span>
          }
        />
        {unit != null && unit > 0 && (
          <CardStatLine label="Avg. per item" value={`${formatGp(unit)} gp`} />
        )}
        {item.drops != null && item.drops > 0 && (
          <CardStatLine
            label="Received in"
            value={`${item.drops.toLocaleString()} drop${item.drops === 1 ? "" : "s"}`}
          />
        )}
        {share != null && share >= 1 && (
          <CardStatLine label={`Share of ${npc.name}`} value={`${Math.round(share)}%`} />
        )}
      </div>
      {(item.first_ts != null || item.last_ts != null) && (
        <div className={`${CARD_SECTION_CLASS} space-y-1`}>
          {item.first_ts != null && (
            <CardStatLine label="First received" value={formatRelativeTime(item.first_ts)} />
          )}
          {item.last_ts != null && (
            <CardStatLine label="Last received" value={formatRelativeTime(item.last_ts)} />
          )}
        </div>
      )}
    </div>
  );
}

function NpcBox({ npc }: { npc: LootTrackerNpc }) {
  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="border-osrs-bronze/25 bg-osrs-surface-2/70 flex items-baseline gap-2 border-b px-3 py-2">
        <Link
          href={entityPath("npcs", npc.npc_id, npc.name)}
          className="hover:text-osrs-gold-bright truncate text-sm font-medium transition-colors"
          title={npc.name}
        >
          {npc.name}
        </Link>
        <span className="text-osrs-parchment-dark/60 shrink-0 text-xs tabular-nums">
          × {npc.kills.toLocaleString()}
        </span>
        <span className="text-osrs-gold-bright ml-auto shrink-0 text-xs font-semibold tabular-nums">
          {npc.loot.value_formatted}
        </span>
      </div>
      <div className="grid grid-cols-5">
        {npc.items.map((item) => (
          <HoverCard
            key={item.item_id}
            content={<ItemCardContent item={item} npc={npc} />}
            className="border-osrs-bronze/15 hover:bg-osrs-bronze/10 relative flex aspect-square cursor-help items-center justify-center border-r border-b p-1 transition-colors"
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
          </HoverCard>
        ))}
      </div>
    </Card>
  );
}

export function LootTracker({ playerId, initial }: { playerId: number; initial: PlayerLootTracker }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [loadingAllTime, setLoadingAllTime] = useState(false);
  // Periods already fetched this visit — switching back is instant.
  const cache = useRef(new Map<LootPeriod, PlayerLootTracker>([[initial.partition, initial]]));
  // The month to come back to when leaving the all-time view.
  const lastMonth = useRef(initial.partition);

  const allTime = data.all_time === true;
  const atNewest = data.partition >= currentPartition();
  const atOldest = data.partition <= data.earliest_partition;

  async function load(target: LootPeriod) {
    setShowAll(false);
    setError(null);
    if (target !== LOOT_ALL_TIME) lastMonth.current = target;
    const cached = cache.current.get(target);
    if (cached) {
      setData(cached);
      return;
    }
    setLoading(true);
    setLoadingAllTime(target === LOOT_ALL_TIME);
    try {
      const res = await fetch(`/api/players/${playerId}/loot?partition=${target}`);
      if (!res.ok) {
        // The backend caps each read server-side and 503s rather than hanging
        // when an account has too much history to summarise at once.
        throw new Error(
          res.status === 503
            ? "That’s too much loot to total up right now — browse it a month at a time."
            : target === LOOT_ALL_TIME
              ? "Couldn’t load all-time loot — try again."
              : "Couldn’t load that month — try again.",
        );
      }
      const payload = (await res.json()) as PlayerLootTracker;
      cache.current.set(target, payload);
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t load that — try again.");
    } finally {
      setLoading(false);
    }
  }

  const periodTotal = data.npcs.reduce((sum, npc) => sum + npc.loot.value, 0);
  const visible = showAll ? data.npcs : data.npcs.slice(0, INITIAL_BOXES);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="border-osrs-bronze/40 flex items-center rounded border">
          <button
            type="button"
            onClick={() => load(shiftPartition(data.partition, -1))}
            disabled={loading || allTime || atOldest}
            aria-label="Previous month"
            className="hover:bg-osrs-bronze/30 px-2.5 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-30"
          >
            ‹
          </button>
          <span className="border-osrs-bronze/40 min-w-32 border-x px-3 py-1 text-center text-sm font-medium">
            {periodLabel(data)}
          </span>
          <button
            type="button"
            onClick={() => load(shiftPartition(data.partition, 1))}
            disabled={loading || allTime || atNewest}
            aria-label="Next month"
            className="hover:bg-osrs-bronze/30 px-2.5 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-30"
          >
            ›
          </button>
        </div>
        <button
          type="button"
          onClick={() => load(allTime ? lastMonth.current : LOOT_ALL_TIME)}
          disabled={loading}
          aria-pressed={allTime}
          className={`border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
            allTime ? "bg-osrs-bronze/30 text-osrs-gold-bright" : ""
          }`}
        >
          {allTime ? "Show a month" : "Show all-time"}
        </button>
        {data.npcs.length > 0 && (
          <span className="text-osrs-parchment-dark/60 text-sm">
            {data.npcs.length.toLocaleString()} NPCs •{" "}
            <span className="text-osrs-gold-bright font-semibold">{formatGp(periodTotal)} gp</span>
            {allTime && <> • since {partitionLabel(data.earliest_partition)}</>}
          </span>
        )}
        {loading && (
          <span className="text-osrs-parchment-dark/60 text-sm" role="status">
            {/* Building an account's first all-time view reads every month it
                has — seconds on a long-lived account, instant afterwards. */}
            {loadingAllTime ? "Adding up every month…" : "Loading…"}
          </span>
        )}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>

      {data.npcs.length === 0 ? (
        <EmptyState
          title={allTime ? "No tracked loot yet" : `No tracked loot in ${partitionLabel(data.partition)}`}
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
