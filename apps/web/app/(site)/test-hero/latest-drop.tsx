"use client";

/**
 * The hero's "Latest notable drop" line.
 *
 * Seeded server-side from the recent-feed snapshot, then kept current from the
 * same `feed` SSE scope the site ticker uses — so it changes as drops land
 * rather than only when the page is re-rendered.
 *
 * The bar is deliberately low: the previous version showed the single *biggest*
 * drop in the feed window, so one 1.4B Twisted bow could sit there for hours.
 * Newest-above-the-bar turns it back into a pulse — currently about one every
 * ten minutes.
 *
 * 10M is not arbitrary — it is the same threshold `services/realtime.py` uses
 * to decide what reaches the `feed` scope at all, so this filter agrees with
 * the stream rather than discarding part of it.
 */
import { useState } from "react";
import { formatGp } from "@/lib/format";
import { useEventStream } from "@/lib/use-event-stream";
import { itemIcon } from "./showcase-data";

/** Minimum GP for a drop to count as "notable" on the homepage. */
export const NOTABLE_GP = 10_000_000;

export interface NotableDrop {
  itemId: number;
  itemName: string;
  npcName: string | null;
  playerName: string;
  value: number;
  ts: number;
}

/** Pull a notable drop out of a realtime envelope, or null. */
export function toNotableDrop(
  type: string,
  data: Record<string, unknown>,
  ts: number,
): NotableDrop | null {
  if (type !== "drop") return null;
  const itemId = Number(data.item_id ?? 0);
  const value = Number(data.value ?? 0);
  if (!Number.isFinite(itemId) || itemId <= 0) return null;
  if (!Number.isFinite(value) || value < NOTABLE_GP) return null;
  return {
    itemId,
    itemName: typeof data.item_name === "string" ? data.item_name : "an item",
    npcName: typeof data.npc_name === "string" ? data.npc_name : null,
    playerName: typeof data.player_name === "string" ? data.player_name : "someone",
    value,
    ts: Number(data.ts ?? ts) || ts,
  };
}

export function LatestDrop({ seed }: { seed: NotableDrop | null }) {
  const [drop, setDrop] = useState<NotableDrop | null>(seed);

  useEventStream(["feed"], (event) => {
    const next = toNotableDrop(event.type, event.data, event.ts);
    // Only move forward in time — the stream can interleave slightly.
    if (next && (!drop || next.ts >= drop.ts)) setDrop(next);
  });

  if (!drop) return null;

  return (
    <p className="th-latest" key={`${drop.itemId}-${drop.ts}`}>
      <img src={itemIcon(drop.itemId)} alt="" />
      <span>
        <em>Latest notable drop:</em> <b>{drop.itemName}</b>{" "}
        <span className="th-latest-gp">{formatGp(drop.value)} gp</span>
        {drop.npcName && <> from {drop.npcName}</>}, received by {drop.playerName}
      </span>
    </p>
  );
}
