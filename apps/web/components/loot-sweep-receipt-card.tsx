"use client";

/**
 * Hover card for one Loot Sweep item × team cell — the same rich-popover
 * treatment players/groups get elsewhere on the site (entity-hover-card).
 *
 * Reads top-to-bottom like a sentence: item header → a status panel with the
 * one number that matters ("3 of 5 received · 24 pts banked · next is worth
 * 6") → the per-receipt point schedule → the ledger of who pulled each one,
 * how long ago, with the screenshot proof when a row carries one.
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
const RECEIPT_ROWS = 8;

function fmt(n: number): string {
  return n.toLocaleString();
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-osrs-parchment-dark/50 mb-1.5 text-[10px] font-medium uppercase tracking-wider">
      {children}
    </p>
  );
}

export function LootSweepReceiptCard({
  eventId,
  set,
  item,
  team,
  count,
  banked,
}: {
  eventId: number;
  set: Pick<LootSweepSet, "task_id" | "label" | "decay_percent" | "decay_mode">;
  item: LootSweepConfigItem;
  team: { id: number; name: string; color: string };
  /** The cell's receipt count — renders the status instantly, pre-fetch. */
  count: number;
  /** Points this team has banked on the item so far (the cell's total). */
  banked: number;
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
  const capped = scored >= max;
  const receipts = data?.teams.find((t) => t.team_id === team.id)?.receipts;
  const isPet = item.source === "pet";
  const bonus = item.counts_for_group === false;

  return (
    <div className="p-3 text-sm">
      <div className="flex items-center gap-2.5">
        <ItemDbIcon itemId={item.item_id} size={34} />
        <div className="min-w-0 flex-1">
          <p className="text-osrs-parchment truncate font-semibold leading-tight">
            {item.item_name}
            {(isPet || bonus) && (
              <span className="text-osrs-gold/70 ring-osrs-gold/30 ml-1.5 rounded px-1 align-middle text-[9px] font-medium uppercase tracking-wider ring-1">
                {isPet ? "pet" : "bonus"}
              </span>
            )}
          </p>
          <p className="text-osrs-parchment-dark/60 truncate text-xs">{set.label}</p>
        </div>
      </div>

      {/* Status panel: the summary a passing hover should answer instantly. */}
      <div className="bg-osrs-surface-1 border-osrs-bronze/20 mt-2.5 rounded-md border px-2.5 py-2">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
          <span className="min-w-0 truncate font-medium" style={{ color: team.color }}>
            {team.name}
          </span>
          <span className="text-osrs-parchment ml-auto shrink-0 font-semibold">
            {count === 0 ? "not received yet" : `${fmt(count)} of ${max} received`}
          </span>
        </div>
        <p className="text-osrs-gold-bright mt-1 text-xs font-medium">
          {count === 0
            ? `First one is worth ${fmt(seq[0] ?? item.points)} pts`
            : capped
              ? `${fmt(banked)} pts banked · cap reached — extras score 0`
              : `${fmt(banked)} pts banked · next is worth ${fmt(seq[scored] ?? 0)} pts`}
        </p>
      </div>

      <div className="mt-2.5">
        <Caption>Points per receipt</Caption>
        <div className="flex flex-wrap items-center gap-1" aria-label="points per receipt">
          {seq.slice(0, SCHEDULE_CHIPS).map((pts, i) => (
            <span
              key={i}
              className={`rounded px-1.5 py-0.5 text-[11px] font-medium leading-none tabular-nums ${
                i < scored
                  ? "bg-osrs-gold/20 text-osrs-gold-bright"
                  : i === scored && !capped
                    ? "ring-osrs-gold/60 text-osrs-parchment ring-1"
                    : "text-osrs-parchment-dark/45"
              }`}
              title={
                i < scored
                  ? `Receipt ${i + 1}: earned`
                  : i === scored && !capped
                    ? "Next receipt"
                    : `Receipt ${i + 1}`
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
      </div>

      {count > 0 && (
        <div className={CARD_SECTION_CLASS}>
          <Caption>Received by</Caption>
          {failed ? (
            <p className="text-osrs-parchment-dark/60 text-xs">
              Couldn&apos;t load the ledger — try again in a moment.
            </p>
          ) : !receipts ? (
            <div className="space-y-2" aria-hidden>
              <div className="bg-osrs-bronze/20 h-3 w-3/4 animate-pulse rounded" />
              <div className="bg-osrs-bronze/20 h-3 w-1/2 animate-pulse rounded" />
            </div>
          ) : receipts.length === 0 ? (
            <p className="text-osrs-parchment-dark/60 text-xs">
              Received {fmt(count)}× — ledger details unavailable.
            </p>
          ) : (
            <ul className="divide-osrs-bronze/15 -my-1 divide-y">
              {receipts.slice(0, RECEIPT_ROWS).map((r) => (
                <li key={r.n} className="py-1.5 text-xs">
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
                      <span className="text-osrs-parchment-dark/50 shrink-0">×{r.quantity}</span>
                    )}
                    <span className="text-osrs-gold-bright ml-auto shrink-0 tabular-nums">
                      +{fmt(r.points)}
                    </span>
                  </div>
                  <div className="text-osrs-parchment-dark/50 mt-0.5 pl-[1.875rem] text-[11px]">
                    {timeAgo(r.received_at)}
                  </div>
                  {r.proof_url && (
                    <a
                      href={r.proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 block pl-[1.875rem]"
                      title="Open screenshot"
                    >
                      <img
                        src={r.proof_url}
                        alt={`Screenshot of ${item.item_name}`}
                        loading="lazy"
                        className="border-osrs-bronze/25 hover:border-osrs-gold/50 h-20 w-full rounded-md border object-cover"
                        onError={(e) =>
                          ((e.currentTarget as HTMLImageElement).style.display = "none")
                        }
                      />
                    </a>
                  )}
                </li>
              ))}
              {receipts.length > RECEIPT_ROWS && (
                <li className="text-osrs-parchment-dark/50 py-1.5 text-[11px]">
                  …and {fmt(receipts.length - RECEIPT_ROWS)} more
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
