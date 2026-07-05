"use client";

/**
 * Site-wide live drop feed. Sticks to the top of the page and scrolls a
 * continuous marquee of high-value drops as they're notified, sourced from
 * the "feed" realtime scope (`services/realtime.py::publish_drop`, gated to
 * drops >= 1M GP so the banner stays meaningful under load). On mount it also
 * hydrates from `/api/feed/recent`, which reads a capped Redis history list
 * so the ticker starts pre-filled instead of empty.
 */
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useEventStream } from "@/lib/use-event-stream";
import { formatGp } from "@/lib/format";

const MAX_ITEMS = 15;

type FeedDrop = {
  key: string;
  playerId: number | null;
  playerName: string;
  itemName: string | null;
  npcName: string | null;
  iconUrl: string | null;
  npcIconUrl: string | null;
  value: number;
};

function toFeedDrop(data: Record<string, unknown>, fallbackKey: string): FeedDrop | null {
  const value = Number(data.value ?? 0);
  if (!Number.isFinite(value) || value <= 0) return null;
  return {
    key: fallbackKey,
    playerId: typeof data.player_id === "number" ? data.player_id : null,
    playerName: typeof data.player_name === "string" ? data.player_name : "Someone",
    itemName: typeof data.item_name === "string" ? data.item_name : null,
    npcName: typeof data.npc_name === "string" ? data.npc_name : null,
    iconUrl: typeof data.icon_url === "string" ? data.icon_url : null,
    npcIconUrl: typeof data.npc_icon_url === "string" ? data.npc_icon_url : null,
    value,
  };
}

function TickerEntry({ d }: { d: FeedDrop }) {
  return (
    <span className="flex shrink-0 items-center gap-2 px-6 text-sm whitespace-nowrap">
      {d.playerId ? (
        <Link href={`/players/${d.playerId}` as Route} className="hover:text-osrs-gold-bright font-medium">
          {d.playerName}
        </Link>
      ) : (
        <span className="font-medium">{d.playerName}</span>
      )}
      <span className="text-osrs-parchment-dark/70">received</span>
      {d.iconUrl ? (
        <img src={d.iconUrl} alt="" className="size-5 object-contain" />
      ) : (
        <span className="bg-osrs-bronze/30 size-5 rounded" aria-hidden />
      )}
      <span className="text-osrs-gold-bright font-medium">{d.itemName ?? "an item"}</span>
      {d.npcName && (
        <>
          <span className="text-osrs-parchment-dark/70">from</span>
          {d.npcIconUrl && <img src={d.npcIconUrl} alt="" className="size-5 object-contain" />}
          <span className="text-osrs-parchment-dark/70">{d.npcName}</span>
        </>
      )}
      <span className="text-osrs-green font-semibold">{formatGp(d.value)} gp</span>
    </span>
  );
}

export function LiveDropTicker() {
  const [drops, setDrops] = useState<FeedDrop[]>([]);

  // Hydrate with recent history on mount so the ticker is never empty on
  // first paint — it doesn't have to wait for the next live drop.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/feed/recent")
      .then((res) => (res.ok ? res.json() : []))
      .then((events: Array<{ data: Record<string, unknown> }>) => {
        if (cancelled || !Array.isArray(events)) return;
        const seeded = events
          .map((e, i) => toFeedDrop(e.data ?? {}, `history-${i}-${e.data?.ts ?? i}`))
          .filter((d): d is FeedDrop => d !== null)
          .slice(0, MAX_ITEMS);
        if (seeded.length > 0) setDrops(seeded);
      })
      .catch(() => {
        /* ignore — the empty state / live stream still works */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEventStream(["feed"], (event) => {
    if (event.type !== "drop") return;
    const entry = toFeedDrop(event.data, `${event.data.player_id ?? "?"}-${event.ts}-${Math.random()}`);
    if (!entry) return;
    setDrops((prev) => [entry, ...prev].slice(0, MAX_ITEMS));
  });

  if (drops.length === 0) {
    return (
      <div className="border-osrs-bronze/40 bg-osrs-surface-1/95 border-b">
        <div className="text-osrs-parchment-dark/50 px-4 py-1.5 text-center text-xs">
          Live drop feed — waiting for the next big drop…
        </div>
      </div>
    );
  }

  // Roughly constant px/sec regardless of item count so the pace feels steady.
  const durationSec = Math.max(12, drops.length * 4);

  return (
    <div className="border-osrs-bronze/40 bg-osrs-surface-1/95 overflow-hidden border-b py-1.5">
      {/* Content is duplicated so the marquee loops seamlessly at -50%. */}
      <div
        key={drops[0]?.key}
        className="flex w-max"
        style={{ animation: `marquee ${durationSec}s linear infinite` }}
      >
        <div className="flex">
          {drops.map((d) => (
            <TickerEntry key={d.key} d={d} />
          ))}
        </div>
        <div className="flex" aria-hidden>
          {drops.map((d) => (
            <TickerEntry key={`dup-${d.key}`} d={d} />
          ))}
        </div>
      </div>
    </div>
  );
}
