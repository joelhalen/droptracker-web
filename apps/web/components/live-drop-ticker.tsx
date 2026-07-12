"use client";

/**
 * Site-wide live drop feed. Sticks to the top of the page and scrolls a
 * continuous marquee of high-value drops as they're notified, sourced from
 * the "feed" realtime scope (`services/realtime.py::publish_drop`, gated to
 * drops >= 1M GP so the banner stays meaningful under load). On mount it also
 * hydrates from `/api/feed/recent`, which reads a capped Redis history list
 * so the ticker starts pre-filled instead of empty.
 */
import Link from "next/link";
import { entityPath } from "@/lib/slug";
import { useEffect, useState } from "react";
import { useEventStream } from "@/lib/use-event-stream";
import { formatGp } from "@/lib/format";
import { EntityHoverCard } from "@/components/entity-hover-card";

const MAX_ITEMS = 15;

type FeedDrop = {
  key: string;
  playerId: number | null;
  playerName: string;
  itemId: number | null;
  itemName: string | null;
  npcId: number | null;
  npcName: string | null;
  iconUrl: string | null;
  npcIconUrl: string | null;
  value: number;
};

function parseFeedEntityId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function resolveNpcId(data: Record<string, unknown>): number | null {
  const fromField = parseFeedEntityId(data.npc_id);
  if (fromField !== null) return fromField;
  const iconUrl = typeof data.npc_icon_url === "string" ? data.npc_icon_url : null;
  if (!iconUrl) return null;
  const match = /\/npcdb\/(\d+)/.exec(iconUrl);
  return match ? parseFeedEntityId(match[1]) : null;
}

function toFeedDrop(data: Record<string, unknown>, fallbackKey: string): FeedDrop | null {
  const value = Number(data.value ?? 0);
  if (!Number.isFinite(value) || value <= 0) return null;
  const npcIconUrl = typeof data.npc_icon_url === "string" ? data.npc_icon_url : null;
  return {
    key: fallbackKey,
    playerId: typeof data.player_id === "number" ? data.player_id : null,
    playerName: typeof data.player_name === "string" ? data.player_name : "Someone",
    itemId: typeof data.item_id === "number" ? data.item_id : null,
    itemName: typeof data.item_name === "string" ? data.item_name : null,
    npcId: resolveNpcId(data),
    npcName: typeof data.npc_name === "string" ? data.npc_name : null,
    iconUrl: typeof data.icon_url === "string" ? data.icon_url : null,
    npcIconUrl,
    value,
  };
}

function TickerEntry({ d }: { d: FeedDrop }) {
  return (
    <span className="flex shrink-0 items-center gap-2 px-6 text-sm whitespace-nowrap">
      {d.playerId ? (
        // The marquee pauses while the pointer is over the ticker (see the
        // animation wrapper), so the hover card has a stable anchor.
        <EntityHoverCard kind="player" id={d.playerId} name={d.playerName}>
          <Link href={entityPath("players", d.playerId, d.playerName)} className="hover:text-osrs-gold-bright font-medium">
            {d.playerName}
          </Link>
        </EntityHoverCard>
      ) : (
        <span className="font-medium">{d.playerName}</span>
      )}
      <span className="text-osrs-parchment-dark/70">received</span>
      {d.iconUrl ? (
        <img src={d.iconUrl} alt="" className="size-5 object-contain" />
      ) : (
        <span className="bg-osrs-bronze/30 size-5 rounded" aria-hidden />
      )}
      {d.itemId ? (
        <Link
          href={entityPath("items", d.itemId, d.itemName)}
          className="text-osrs-gold-bright font-medium hover:underline"
        >
          {d.itemName ?? "an item"}
        </Link>
      ) : (
        <span className="text-osrs-gold-bright font-medium">{d.itemName ?? "an item"}</span>
      )}
      {d.npcName && (
        <>
          <span className="text-osrs-parchment-dark/70">from</span>
          {d.npcIconUrl && <img src={d.npcIconUrl} alt="" className="size-5 object-contain" />}
          {d.npcId ? (
            <Link
              href={entityPath("npcs", d.npcId, d.npcName)}
              className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright hover:underline"
            >
              {d.npcName}
            </Link>
          ) : (
            <span className="text-osrs-parchment-dark/70">{d.npcName}</span>
          )}
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
  const durationSec = Math.max(12, drops.length * 8);

  return (
    <div className="border-osrs-bronze/40 bg-osrs-surface-1/95 overflow-hidden border-b py-1.5">
      {/* Content is duplicated so the marquee loops seamlessly at -50%.
          Pausing on hover keeps entries still so their hover cards are usable. */}
      <div
        key={drops[0]?.key}
        className="flex w-max hover:[animation-play-state:paused]"
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
