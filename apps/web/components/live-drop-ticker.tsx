"use client";

/**
 * Site-wide live activity ticker. Sticks to the top of the page and scrolls a
 * continuous marquee of high-value happenings sourced from the "feed"
 * realtime scope (backend `services/realtime.py`):
 *
 *  - `drop`           single items worth >= 10M GP
 *  - `personal_best`  new PBs landing in the top 25 of their boss board
 *  - `pet`            newly obtained pets
 *  - `group_created`  a new group registered
 *  - `new_player`     a new player started tracking (sampled server-side)
 *  - `subscription`   a group/player's first premium payment
 *
 * On mount it also hydrates from `/api/feed/recent`, which reads a capped
 * Redis history of the same typed envelopes so the ticker starts pre-filled.
 */
import Link from "next/link";
import { entityPath } from "@/lib/slug";
import { useEffect, useState } from "react";
import { useEventStream } from "@/lib/use-event-stream";
import { formatGp } from "@/lib/format";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { COINS_ICON } from "@/components/gp-amount";
import { toFeedEntry, type FeedEntry } from "@/lib/feed-entries";

const MAX_ITEMS = 15;

/** Player name that links to the profile (with hover card) when we have an id. */
function PlayerRef({ id, name }: { id: number | null; name: string }) {
  if (!id) return <span className="font-medium">{name}</span>;
  return (
    // The marquee pauses while the pointer is over the ticker (see the
    // animation wrapper), so the hover card has a stable anchor.
    <EntityHoverCard kind="player" id={id} name={name}>
      <Link href={entityPath("players", id, name)} className="hover:text-osrs-gold-bright font-medium">
        {name}
      </Link>
    </EntityHoverCard>
  );
}

function teamSizeLabel(teamSize: string | null): string | null {
  if (!teamSize) return null;
  return teamSize === "Solo" ? "Solo" : `${teamSize} players`;
}

function TickerEntry({ e }: { e: FeedEntry }) {
  const muted = "text-osrs-parchment-dark/70";
  const inner = (() => {
    switch (e.kind) {
      case "drop":
        return (
          <>
            <PlayerRef id={e.playerId} name={e.playerName} />
            <span className={muted}>received</span>
            {e.iconUrl ? (
              <img src={e.iconUrl} alt="" className="size-5 object-contain" />
            ) : (
              <span className="bg-osrs-bronze/30 size-5 rounded" aria-hidden />
            )}
            {e.itemId ? (
              <Link
                href={entityPath("items", e.itemId, e.itemName)}
                className="text-osrs-gold-bright font-medium hover:underline"
              >
                {e.itemName ?? "an item"}
              </Link>
            ) : (
              <span className="text-osrs-gold-bright font-medium">{e.itemName ?? "an item"}</span>
            )}
            {e.npcName && (
              <>
                <span className={muted}>from</span>
                {e.npcIconUrl && <img src={e.npcIconUrl} alt="" className="size-5 object-contain" />}
                {e.npcId ? (
                  <Link
                    href={entityPath("npcs", e.npcId, e.npcName)}
                    className={`${muted} hover:text-osrs-gold-bright hover:underline`}
                  >
                    {e.npcName}
                  </Link>
                ) : (
                  <span className={muted}>{e.npcName}</span>
                )}
              </>
            )}
            <span className="flex items-center gap-1">
              <img src={COINS_ICON} alt="" aria-hidden className="size-4 object-contain" />
              <span className="text-osrs-green font-semibold">{formatGp(e.value)} gp</span>
            </span>
          </>
        );
      case "personal_best": {
        const sizeLabel = teamSizeLabel(e.teamSize);
        return (
          <>
            <span aria-hidden>⏱️</span>
            <PlayerRef id={e.playerId} name={e.playerName} />
            <span className={muted}>set the</span>
            <span className="text-osrs-gold-bright font-semibold">#{e.rank}</span>
            <span className={muted}>time at</span>
            {e.npcIconUrl && <img src={e.npcIconUrl} alt="" className="size-5 object-contain" />}
            {e.npcId ? (
              <Link
                href={entityPath("npcs", e.npcId, e.npcName)}
                className="font-medium hover:text-osrs-gold-bright hover:underline"
              >
                {e.npcName}
              </Link>
            ) : (
              <span className="font-medium">{e.npcName}</span>
            )}
            {sizeLabel && <span className={muted}>({sizeLabel})</span>}
            <span className="text-osrs-green font-semibold">{e.timeDisplay}</span>
          </>
        );
      }
      case "pet":
        return (
          <>
            <span aria-hidden>🐾</span>
            <PlayerRef id={e.playerId} name={e.playerName} />
            <span className={muted}>just received a pet:</span>
            {e.iconUrl && <img src={e.iconUrl} alt="" className="size-5 object-contain" />}
            {e.itemId ? (
              <Link
                href={entityPath("items", e.itemId, e.petName)}
                className="text-osrs-gold-bright font-medium hover:underline"
              >
                {e.petName}
              </Link>
            ) : (
              <span className="text-osrs-gold-bright font-medium">{e.petName}</span>
            )}
          </>
        );
      case "group_created":
        return (
          <>
            <span aria-hidden>🎉</span>
            <EntityHoverCard kind="group" id={e.groupId} name={e.groupName}>
              <Link
                href={entityPath("groups", e.groupId, e.groupName)}
                className="text-osrs-gold-bright font-medium hover:underline"
              >
                {e.groupName}
              </Link>
            </EntityHoverCard>
            <span className={muted}>just registered their group on DropTracker</span>
          </>
        );
      case "new_player":
        return (
          <>
            <span aria-hidden>👋</span>
            <PlayerRef id={e.playerId} name={e.playerName} />
            <span className={muted}>started tracking</span>
            {e.playerNumber && (
              <span className={muted}>— player #{e.playerNumber.toLocaleString()}</span>
            )}
          </>
        );
      case "subscription":
        return (
          <>
            <span aria-hidden>❤️</span>
            {e.scope === "group" && e.groupId ? (
              <EntityHoverCard kind="group" id={e.groupId} name={e.name}>
                <Link
                  href={entityPath("groups", e.groupId, e.name)}
                  className="text-osrs-gold-bright font-medium hover:underline"
                >
                  {e.name}
                </Link>
              </EntityHoverCard>
            ) : (
              <PlayerRef id={e.playerId} name={e.name} />
            )}
            <span className={muted}>
              {e.scope === "group" ? "just upgraded to Premium!" : "just became a supporter!"}
            </span>
          </>
        );
    }
  })();

  return (
    <span className="font-osrs flex shrink-0 items-center gap-2 px-6 text-sm whitespace-nowrap">
      {inner}
    </span>
  );
}

export function LiveDropTicker({ scope }: { scope?: string } = {}) {
  const [entries, setEntries] = useState<FeedEntry[]>([]);

  // Hydrate with recent history on mount so the ticker is never empty on
  // first paint — it doesn't have to wait for the next live event.
  useEffect(() => {
    let cancelled = false;
    // Scoped tickers (group sites) have no history endpoint; live-only.
    if (scope) return;
    fetch("/api/feed/recent")
      .then((res) => (res.ok ? res.json() : []))
      .then((events: Array<{ type?: string; data: Record<string, unknown> }>) => {
        if (cancelled || !Array.isArray(events)) return;
        const seeded = events
          .map((e, i) =>
            toFeedEntry(e.type ?? "drop", e.data ?? {}, `history-${i}-${e.data?.ts ?? i}`),
          )
          .filter((d): d is FeedEntry => d !== null)
          .slice(0, MAX_ITEMS);
        if (seeded.length > 0) setEntries(seeded);
      })
      .catch(() => {
        /* ignore — the empty state / live stream still works */
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  useEventStream([scope ?? "feed"], (event) => {
    const entry = toFeedEntry(
      event.type,
      event.data,
      `${event.type}-${event.data.player_id ?? event.data.group_id ?? "?"}-${event.ts}-${Math.random()}`,
    );
    if (!entry) return;
    setEntries((prev) => [entry, ...prev].slice(0, MAX_ITEMS));
  });

  if (entries.length === 0) {
    return (
      <div className="border-osrs-bronze/40 bg-osrs-surface-1/95 border-b">
        <div className="text-osrs-parchment-dark/50 px-4 py-1.5 text-center text-xs">
          Live feed — waiting for the next big drop…
        </div>
      </div>
    );
  }

  // Roughly constant px/sec regardless of item count so the pace feels steady.
  const durationSec = Math.max(12, entries.length * 8);

  return (
    <div className="border-osrs-bronze/40 bg-osrs-surface-1/95 overflow-hidden border-b py-1.5">
      {/* Content is duplicated so the marquee loops seamlessly at -50%.
          Pausing on hover keeps entries still so their hover cards are usable. */}
      <div
        key={entries[0]?.key}
        className="flex w-max hover:[animation-play-state:paused]"
        style={{ animation: `marquee ${durationSec}s linear infinite` }}
      >
        <div className="flex">
          {entries.map((e) => (
            <TickerEntry key={e.key} e={e} />
          ))}
        </div>
        <div className="flex" aria-hidden>
          {entries.map((e) => (
            <TickerEntry key={`dup-${e.key}`} e={e} />
          ))}
        </div>
      </div>
    </div>
  );
}
