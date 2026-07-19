"use client";

/**
 * Hover card for one Loot Sweep item × team cell — the same rich-popover
 * treatment players/groups get elsewhere on the site (entity-hover-card).
 *
 * Shows the item's full decay schedule with this team's position marked
 * (earned / next / remaining), then the team's receipt ledger: who pulled
 * each one, how long ago, the points it credited, and the screenshot proof
 * when the ledger row carries one.
 *
 * The ledger is fetched lazily the FIRST time any of the item's cells opens
 * a card — one request returns every team's receipts for that item, cached
 * per (event, set, item) until the board refetches (a scoring frame clears
 * the cache via {@link clearLootSweepReceiptsCache}).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import type { LootSweepConfigItem, LootSweepReceipts, LootSweepSet } from "@droptracker/api-types";
import { fetchLootSweepReceipts } from "@/app/(site)/(public)/events/[id]/actions";
import { CARD_SECTION_CLASS } from "@/components/hover-card";
import { ItemDbIcon } from "@/components/item-db-icon";
import { decaySequence } from "@/lib/loot-sweep";
import { maxAwardsOf, timeAgo } from "@/lib/loot-sweep-matrix";

const cache = new Map<string, LootSweepReceipts>();
const inflight = new Map<string, Promise<LootSweepReceipts>>();

/** Board refetch = the ledger may have moved; next hover refetches. */
export function clearLootSweepReceiptsCache(): void {
  cache.clear();
  inflight.clear();
}

function load(eventId: number, taskId: number, item: string): Promise<LootSweepReceipts> {
  const key = `${eventId}:${taskId}:${item.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending) return pending;
  const promise = fetchLootSweepReceipts(eventId, taskId, item)
    .then((data) => {
      cache.set(key, data);
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

const SCHEDULE_CHIPS = 12;
const RECEIPT_ROWS = 10;

function fmt(n: number): string {
  return n.toLocaleString();
}

export function LootSweepReceiptCard({
  eventId,
  set,
  item,
  team,
  count,
}: {
  eventId: number;
  set: Pick<LootSweepSet, "task_id" | "label" | "decay_percent" | "decay_mode">;
  item: LootSweepConfigItem;
  team: { id: number; name: string; color: string };
  /** The cell's receipt count — marks the schedule instantly, pre-fetch. */
  count: number;
}) {
  const [data, setData] = useState<LootSweepReceipts | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    load(eventId, set.task_id, item.item_name).then(
      (d) => alive && setData(d),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [eventId, set.task_id, item.item_name]);

  const max = maxAwardsOf(item);
  const apt = item.awards_per_tier ?? 1;
  const seq = decaySequence(item.points, max, set.decay_percent, apt, set.decay_mode);
  const scored = Math.min(count, max);
  const receipts = data?.teams.find((t) => t.team_id === team.id)?.receipts;
  const isPet = item.source === "pet";
  const bonus = item.counts_for_group === false;

  return (
    <div className="text-sm">
      <div className="flex items-center gap-2.5">
        <ItemDbIcon itemId={item.item_id} size={30} />
        <div className="min-w-0 flex-1">
          <p className="text-osrs-parchment truncate font-semibold leading-tight">
            {item.item_name}
          </p>
          <p className="text-osrs-parchment-dark/60 truncate text-xs">
            {set.label}
            {isPet ? " · pet" : bonus ? " · bonus" : ""}
          </p>
        </div>
        <span
          className="max-w-[7rem] truncate text-xs font-medium"
          style={{ color: team.color }}
          title={team.name}
        >
          {team.name}
        </span>
      </div>

      {/* Decay schedule with this team's position: earned · next · remaining. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1" aria-label="points per receipt">
        {seq.slice(0, SCHEDULE_CHIPS).map((pts, i) => (
          <span
            key={i}
            className={`rounded px-1 py-0.5 text-[10px] font-medium leading-none tabular-nums ${
              i < scored
                ? "bg-osrs-gold/20 text-osrs-gold-bright"
                : i === scored
                  ? "ring-osrs-gold/60 text-osrs-parchment ring-1"
                  : "text-osrs-parchment-dark/45"
            }`}
            title={
              i < scored ? `Receipt ${i + 1}: earned` : i === scored ? "Next receipt" : undefined
            }
          >
            {fmt(pts)}
          </span>
        ))}
        {seq.length > SCHEDULE_CHIPS && (
          <span className="text-osrs-parchment-dark/45 text-[10px]">
            +{seq.length - SCHEDULE_CHIPS} more
          </span>
        )}
        {apt > 1 && (
          <span className="text-osrs-parchment-dark/50 text-[10px]">×{apt} per step</span>
        )}
      </div>

      <div className={CARD_SECTION_CLASS}>
        {count === 0 ? (
          <p className="text-osrs-parchment-dark/60 text-xs">
            Not received yet — the first one is worth{" "}
            <span className="text-osrs-gold-bright font-medium">{fmt(seq[0] ?? item.points)}</span>.
          </p>
        ) : failed ? (
          <p className="text-osrs-parchment-dark/60 text-xs">
            Received {count}× — couldn&apos;t load who got them.
          </p>
        ) : !receipts ? (
          <div className="space-y-1.5" aria-hidden>
            <div className="bg-osrs-bronze/20 h-3 w-3/4 animate-pulse rounded" />
            <div className="bg-osrs-bronze/20 h-3 w-1/2 animate-pulse rounded" />
          </div>
        ) : (
          <ul className="space-y-1.5">
            {receipts.slice(0, RECEIPT_ROWS).map((r) => (
              <li key={r.n} className="text-xs">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-osrs-parchment-dark/40 w-6 shrink-0 text-right tabular-nums">
                    #{r.n}
                  </span>
                  {r.player_id != null ? (
                    <Link
                      href={`/players/${r.player_id}`}
                      className="text-osrs-parchment hover:text-osrs-gold-bright min-w-0 truncate font-medium"
                    >
                      {r.player_name ?? `Player ${r.player_id}`}
                    </Link>
                  ) : (
                    <span className="text-osrs-parchment min-w-0 truncate font-medium">
                      {r.player_name ?? "Unknown"}
                    </span>
                  )}
                  {r.quantity > 1 && (
                    <span className="text-osrs-parchment-dark/50">×{r.quantity}</span>
                  )}
                  <span className="text-osrs-gold-bright ml-auto shrink-0 tabular-nums">
                    +{fmt(r.points)}
                  </span>
                  <span className="text-osrs-parchment-dark/50 shrink-0">
                    {timeAgo(r.received_at)}
                  </span>
                </div>
                {r.proof_url && (
                  <a
                    href={r.proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block pl-[1.875rem]"
                    title="Open screenshot"
                  >
                    <img
                      src={r.proof_url}
                      alt={`Screenshot of ${item.item_name}`}
                      loading="lazy"
                      className="border-osrs-bronze/25 hover:border-osrs-gold/50 h-16 w-full rounded border object-cover"
                      onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                    />
                  </a>
                )}
              </li>
            ))}
            {receipts.length > RECEIPT_ROWS && (
              <li className="text-osrs-parchment-dark/50 text-[11px]">
                …and {receipts.length - RECEIPT_ROWS} more
              </li>
            )}
            {receipts.length === 0 && (
              <li className="text-osrs-parchment-dark/60 text-xs">
                Received {count}× (ledger details unavailable).
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
