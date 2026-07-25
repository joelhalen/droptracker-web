"use client";

/**
 * The hero's "Latest notable drop" line.
 *
 * Seeded server-side from the recent-feed snapshot, then kept current from the
 * same `feed` SSE scope the site ticker uses — so it changes as drops land
 * rather than only when the page is re-rendered.
 *
 * The shaping helpers live in ./feed-rows.ts, NOT here: the server page uses
 * them to build the seed, and a "use client" module cannot be called from the
 * server.
 */
import { useState } from "react";
import { formatGp } from "@/lib/format";
import { useEventStream } from "@/lib/use-event-stream";
import { toNotableDrop, type NotableDrop } from "./feed-rows";
import { itemIcon } from "./showcase-data";

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
