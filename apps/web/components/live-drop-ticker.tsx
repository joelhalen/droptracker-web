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

const MAX_ITEMS = 15;

type FeedDrop = {
  kind: "drop";
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

type FeedPersonalBest = {
  kind: "personal_best";
  key: string;
  playerId: number | null;
  playerName: string;
  npcId: number | null;
  npcName: string;
  npcIconUrl: string | null;
  timeDisplay: string;
  teamSize: string | null;
  rank: number;
};

type FeedPet = {
  kind: "pet";
  key: string;
  playerId: number | null;
  playerName: string;
  petName: string;
  itemId: number | null;
  iconUrl: string | null;
};

type FeedGroupCreated = {
  kind: "group_created";
  key: string;
  groupId: number;
  groupName: string;
};

type FeedNewPlayer = {
  kind: "new_player";
  key: string;
  playerId: number | null;
  playerName: string;
  playerNumber: number | null;
};

type FeedSubscription = {
  kind: "subscription";
  key: string;
  scope: "group" | "user";
  name: string;
  groupId: number | null;
  playerId: number | null;
};

type FeedEntry =
  | FeedDrop
  | FeedPersonalBest
  | FeedPet
  | FeedGroupCreated
  | FeedNewPlayer
  | FeedSubscription;

function parseFeedEntityId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function resolveNpcId(data: Record<string, unknown>): number | null {
  const fromField = parseFeedEntityId(data.npc_id);
  if (fromField !== null) return fromField;
  const iconUrl = asString(data.npc_icon_url);
  if (!iconUrl) return null;
  const match = /\/npcdb\/(\d+)/.exec(iconUrl);
  return match ? parseFeedEntityId(match[1]) : null;
}

/** Parse one realtime envelope (`type` + display-ready `data`) into a typed
 *  ticker entry; unknown types and malformed payloads return null. */
function toFeedEntry(
  type: string,
  data: Record<string, unknown>,
  key: string,
): FeedEntry | null {
  switch (type) {
    case "drop": {
      const value = Number(data.value ?? 0);
      if (!Number.isFinite(value) || value <= 0) return null;
      return {
        kind: "drop",
        key,
        playerId: parseFeedEntityId(data.player_id),
        playerName: asString(data.player_name) ?? "Someone",
        itemId: parseFeedEntityId(data.item_id),
        itemName: asString(data.item_name),
        npcId: resolveNpcId(data),
        npcName: asString(data.npc_name),
        iconUrl: asString(data.icon_url),
        npcIconUrl: asString(data.npc_icon_url),
        value,
      };
    }
    case "personal_best": {
      const rank = parseFeedEntityId(data.rank);
      const npcName = asString(data.npc_name);
      const timeDisplay = asString(data.time_display);
      if (!rank || !npcName || !timeDisplay) return null;
      return {
        kind: "personal_best",
        key,
        playerId: parseFeedEntityId(data.player_id),
        playerName: asString(data.player_name) ?? "Someone",
        npcId: resolveNpcId(data),
        npcName,
        npcIconUrl: asString(data.npc_icon_url),
        timeDisplay,
        teamSize: asString(data.team_size),
        rank,
      };
    }
    case "pet": {
      const petName = asString(data.pet_name);
      if (!petName) return null;
      return {
        kind: "pet",
        key,
        playerId: parseFeedEntityId(data.player_id),
        playerName: asString(data.player_name) ?? "Someone",
        petName,
        itemId: parseFeedEntityId(data.item_id),
        iconUrl: asString(data.icon_url),
      };
    }
    case "group_created": {
      const groupId = parseFeedEntityId(data.group_id);
      const groupName = asString(data.group_name);
      if (!groupId || !groupName) return null;
      return { kind: "group_created", key, groupId, groupName };
    }
    case "new_player": {
      const playerName = asString(data.player_name);
      if (!playerName) return null;
      return {
        kind: "new_player",
        key,
        playerId: parseFeedEntityId(data.player_id),
        playerName,
        playerNumber: parseFeedEntityId(data.player_number),
      };
    }
    case "subscription": {
      const name = asString(data.name);
      if (!name) return null;
      return {
        kind: "subscription",
        key,
        scope: data.kind === "group" ? "group" : "user",
        name,
        groupId: parseFeedEntityId(data.group_id),
        playerId: parseFeedEntityId(data.player_id),
      };
    }
    default:
      return null;
  }
}

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
            <span className="text-osrs-green font-semibold">{formatGp(e.value)} gp</span>
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
    <span className="flex shrink-0 items-center gap-2 px-6 text-sm whitespace-nowrap">
      {inner}
    </span>
  );
}

export function LiveDropTicker() {
  const [entries, setEntries] = useState<FeedEntry[]>([]);

  // Hydrate with recent history on mount so the ticker is never empty on
  // first paint — it doesn't have to wait for the next live event.
  useEffect(() => {
    let cancelled = false;
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
  }, []);

  useEventStream(["feed"], (event) => {
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
