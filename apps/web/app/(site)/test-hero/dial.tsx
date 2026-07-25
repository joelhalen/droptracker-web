"use client";

/**
 * The notable-drops dial: two counter-rotating rings around a live stat hub.
 *
 *  - Outer ring  real notable drops (one per item — see `uniqueByItem`)
 *  - Inner ring  the clans currently topping the monthly board
 *  - Hub         platform totals at rest; the hovered entry's owner stats on hover
 *  - Card        a compact label that pops up AT the entry you are pointing at
 *
 * Two hard-won layout rules hold this together, both learned from real bugs:
 *
 *  1. Nothing decorative may hit-test. Each slot is a full-size rotated box, so
 *     ten of them stack and a transparent one still swallows the pointer — the
 *     slots, ring tracks and hub are all `pointer-events: none` and only the
 *     buttons opt back in.
 *  2. The hover card must not steal the pointer. It is deliberately
 *     `pointer-events: none` while hovering, so it can sit right on top of the
 *     entry without the browser handing it the hover (which unmounts the card,
 *     which hands the hover back, forever). Clicking pins it, and only then
 *     does it become interactive.
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { PlayerCard } from "@/lib/entity-card";
import { formatGp } from "@/lib/format";
import { entityPath } from "@/lib/slug";
import { CountUp } from "./motion";
import { itemIcon, npcIcon, type ShowcaseDrop } from "./showcase-data";

/** A clan on the inner ring, resolved server-side in page.tsx. */
export interface DialGroup {
  id: number;
  name: string;
  rank: number;
  memberCount: number;
  monthlyLoot: number;
  iconUrl: string | null;
}

type Entry =
  | { kind: "drop"; key: string; drop: ShowcaseDrop }
  | { kind: "group"; key: string; group: DialGroup };

/** Grace period before a released hover actually clears. */
const HOVER_GRACE_MS = 140;

/** Coarse relative age — "today", "3 days ago", "last month". */
function relativeDays(ts: number): string {
  const days = Math.floor((Date.now() / 1000 - ts) / 86_400);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months <= 1 ? "last month" : `${months} months ago`;
}

/* -------------------------------------------------------------------------- */
/* Player stats, fetched lazily                                               */
/* -------------------------------------------------------------------------- */

/**
 * Monthly loot + global rank for the player behind a hovered drop.
 *
 * Reuses the BFF hover-card endpoint the rest of the site already uses
 * (`/api/players/[id]/card`), so this costs nothing at page render: it is
 * fetched the first time a drop is hovered and memoised for the session.
 */
function usePlayerCard(playerId: number | null): PlayerCard | null {
  const cache = useRef(new Map<number, PlayerCard>());
  const [, force] = useState(0);

  useEffect(() => {
    if (playerId === null || cache.current.has(playerId)) return;
    let cancelled = false;
    fetch(`/api/players/${playerId}/card`)
      .then((res) => (res.ok ? res.json() : null))
      .then((card: PlayerCard | null) => {
        if (cancelled || !card || card.kind !== "player") return;
        cache.current.set(playerId, card);
        force((n) => n + 1);
      })
      .catch(() => {
        /* best-effort — the hub falls back to the drop's own facts */
      });
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  return playerId === null ? null : (cache.current.get(playerId) ?? null);
}

/* -------------------------------------------------------------------------- */
/* Ring                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * One entry on a ring. The slot is a full-size box rotated to the entry's
 * angle, so the orbit radius always tracks the container instead of a
 * hard-coded pixel value; the tile then counter-rotates by the same angle to
 * sit level, and its icon counter-rotates against the carrier's spin.
 */
function RingEntry({
  entry,
  angle,
  ring,
  state,
  onPreview,
  onRelease,
  onToggle,
}: {
  entry: Entry;
  angle: number;
  ring: "outer" | "inner";
  state: "idle" | "active" | "dimmed";
  onPreview: (el: HTMLElement) => void;
  onRelease: () => void;
  onToggle: (el: HTMLElement) => void;
}) {
  const isDrop = entry.kind === "drop";
  const label = isDrop
    ? `${entry.drop.itemName}, ${formatGp(entry.drop.value)} gp — ${entry.drop.playerName} from ${entry.drop.npcName}`
    : `${entry.group.name}, clan rank ${entry.group.rank} — ${formatGp(entry.group.monthlyLoot)} gp this month`;

  return (
    <div className="th-dial-slot" style={{ "--th-a": `${angle}deg` } as CSSProperties}>
      <button
        type="button"
        className="th-dial-item"
        data-ring={ring}
        data-state={state}
        onMouseEnter={(e) => onPreview(e.currentTarget)}
        onMouseLeave={onRelease}
        onFocus={(e) => onPreview(e.currentTarget)}
        onBlur={onRelease}
        onClick={(e) => onToggle(e.currentTarget)}
        aria-label={label}
        aria-pressed={state === "active"}
      >
        {isDrop ? (
          <img src={itemIcon(entry.drop.itemId)} alt="" loading="lazy" />
        ) : entry.group.iconUrl ? (
          <img
            src={entry.group.iconUrl}
            alt=""
            loading="lazy"
            // Clan icons can be self-hosted or a Discord/CDN URL the clan set;
            // a dead one falls back to the monogram rather than a broken image.
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span className="th-dial-mono">{entry.group.name.slice(0, 1).toUpperCase()}</span>
        )}
        {!isDrop && <span className="th-dial-rank">{entry.group.rank}</span>}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hover card                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The pop-up label, anchored at the hovered entry.
 *
 * The position is MEASURED from the entry's own box at hover time, not derived
 * from its slot angle: the carriers rotate continuously, so an entry's real
 * angle is its slot angle plus however far the ring has turned. Deriving it
 * put the card where the entry would have been at rest, up to 160px away.
 * The rings are paused while a card is open, so a measured position stays
 * valid for as long as it is shown.
 */
function HoverCard({
  entry,
  at,
  pinned,
  onHold,
  onRelease,
  onDismiss,
}: {
  entry: Entry;
  /** Entry centre, in percent of the dial box. */
  at: { x: number; y: number };
  pinned: boolean;
  onHold: () => void;
  onRelease: () => void;
  onDismiss: () => void;
}) {
  const { x, y } = at;
  // Sit on whichever side of the entry faces the middle of the dial, so the
  // card leans inward and can never run off the edge of the hero.
  const side = x > 50 ? "left" : "right";

  return (
    <div
      className="th-dial-card"
      data-side={side}
      data-pinned={pinned}
      style={{ left: `${x}%`, top: `${y}%` }}
      onMouseEnter={onHold}
      onMouseLeave={onRelease}
    >
      {entry.kind === "drop" ? (
        <>
          <span className="th-dial-card-shot">
            <img src={entry.drop.src} alt="" loading="lazy" decoding="async" />
          </span>
          <span className="th-dial-card-body">
            <b>{entry.drop.itemName}</b>
            <span className="th-dial-card-gp">{formatGp(entry.drop.value)} gp</span>
            <span className="th-dial-card-meta">
              <img src={npcIcon(entry.drop.npcId)} alt="" />
              {entry.drop.npcName} · {relativeDays(entry.drop.ts)}
            </span>
          </span>
        </>
      ) : (
        <span className="th-dial-card-body">
          <span className="th-dial-card-kicker">Clan · rank #{entry.group.rank}</span>
          <b>{entry.group.name}</b>
          <span className="th-dial-card-gp">{formatGp(entry.group.monthlyLoot)} gp this month</span>
        </span>
      )}

      {pinned && (
        <button type="button" className="th-dial-dismiss" onClick={onDismiss} aria-label="Close">
          ✕
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hub                                                                        */
/* -------------------------------------------------------------------------- */

function Hub({
  entry,
  playerCard,
  monthlyLoot,
  playersTracked,
}: {
  entry: Entry | null;
  playerCard: PlayerCard | null;
  monthlyLoot: number;
  playersTracked: number;
}) {
  // Group: everything already came down with the page.
  if (entry?.kind === "group") {
    const g = entry.group;
    return (
      <div className="th-dial-hub" data-mode="entity">
        <span className="th-dial-hub-name">{g.name}</span>
        <b>{formatGp(g.monthlyLoot)}</b>
        <small>this month</small>
        <dl>
          <div>
            <dt>Global rank</dt>
            <dd>#{g.rank}</dd>
          </div>
          <div>
            <dt>Members</dt>
            <dd>{g.memberCount.toLocaleString()}</dd>
          </div>
        </dl>
      </div>
    );
  }

  // Drop: the player's own standing, once the lazy card lands.
  if (entry?.kind === "drop") {
    const d = entry.drop;
    const loot = playerCard?.total_loot?.value_formatted;
    const rank = playerCard?.global_rank;
    return (
      <div className="th-dial-hub" data-mode="entity">
        <span className="th-dial-hub-name">{d.playerName}</span>
        <b>{loot ?? "—"}</b>
        <small>this month</small>
        <dl>
          <div>
            <dt>Global rank</dt>
            <dd>{rank ? `#${rank}` : "—"}</dd>
          </div>
          <div>
            <dt>Top source</dt>
            <dd>{playerCard?.top_npc ?? d.npcName}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="th-dial-hub">
      <b>
        <CountUp to={monthlyLoot} duration={2200} format={(n) => formatGp(n)} />
      </b>
      <small>tracked this month</small>
      <em>
        <CountUp to={playersTracked} duration={2000} /> accounts
      </em>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Dial                                                                       */
/* -------------------------------------------------------------------------- */

export function Dial({
  drops,
  groups,
  monthlyLoot,
  playersTracked,
}: {
  drops: ShowcaseDrop[];
  groups: DialGroup[];
  monthlyLoot: number;
  playersTracked: number;
}) {
  const [active, setActive] = useState<{ entry: Entry; at: { x: number; y: number } } | null>(null);
  const [pinned, setPinned] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialRef = useRef<HTMLDivElement>(null);

  /** Where an entry's centre sits, as a percentage of the dial box. */
  const locate = useCallback((el: HTMLElement) => {
    const dial = dialRef.current?.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    if (!dial || dial.width === 0) return { x: 50, y: 50 };
    return {
      x: ((box.left + box.width / 2 - dial.left) / dial.width) * 100,
      y: ((box.top + box.height / 2 - dial.top) / dial.height) * 100,
    };
  }, []);

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const preview = useCallback(
    (entry: Entry, el: HTMLElement) => {
      cancel();
      // A pinned card holds until dismissed, so drifting across the rings
      // can't yank it out from under someone mid-read.
      setActive((current) => (pinned && current ? current : { entry, at: locate(el) }));
    },
    [cancel, locate, pinned],
  );

  const release = useCallback(() => {
    if (pinned) return;
    cancel();
    timer.current = setTimeout(() => setActive(null), HOVER_GRACE_MS);
  }, [cancel, pinned]);

  const togglePin = useCallback(
    (entry: Entry, el: HTMLElement) => {
      cancel();
      setActive((current) => {
        const same = current?.entry.key === entry.key;
        setPinned(!(same && pinned));
        return { entry, at: locate(el) };
      });
    },
    [cancel, locate, pinned],
  );

  const dismiss = useCallback(() => {
    cancel();
    setPinned(false);
    setActive(null);
  }, [cancel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dismiss]);

  const playerCard = usePlayerCard(
    active?.entry.kind === "drop" ? active.entry.drop.playerId : null,
  );

  const outer: Entry[] = drops.map((drop) => ({ kind: "drop", key: `d${drop.dropId}`, drop }));
  const inner: Entry[] = groups.map((group) => ({ kind: "group", key: `g${group.id}`, group }));

  const renderRing = (entries: Entry[], ring: "outer" | "inner") =>
    entries.map((entry, i) => {
      const angle = (i / entries.length) * 360 + (ring === "inner" ? 30 : 0);
      return (
        <RingEntry
          key={entry.key}
          entry={entry}
          angle={angle}
          ring={ring}
          state={active === null ? "idle" : active.entry.key === entry.key ? "active" : "dimmed"}
          onPreview={(el) => preview(entry, el)}
          onRelease={release}
          onToggle={(el) => togglePin(entry, el)}
        />
      );
    });

  return (
    <div className="th-dial" ref={dialRef} data-paused={active !== null}>
      <div className="th-dial-track" data-ring="outer" aria-hidden />
      <div className="th-dial-track" data-ring="inner" aria-hidden />

      <div className="th-dial-carrier" data-ring="outer">
        {renderRing(outer, "outer")}
      </div>
      <div className="th-dial-carrier" data-ring="inner">
        {renderRing(inner, "inner")}
      </div>

      <Hub
        entry={active?.entry ?? null}
        playerCard={playerCard}
        monthlyLoot={monthlyLoot}
        playersTracked={playersTracked}
      />

      {active && (
        <HoverCard
          entry={active.entry}
          at={active.at}
          pinned={pinned}
          onHold={cancel}
          onRelease={release}
          onDismiss={dismiss}
        />
      )}

      {/* Pinned cards carry links; expose them once the card is interactive. */}
      {pinned && active && (
        <div className="th-dial-links">
          {active.entry.kind === "drop" ? (
            <>
              <Link
                href={entityPath("items", active.entry.drop.itemId, active.entry.drop.itemName)}
              >
                Item
              </Link>
              <Link href={entityPath("npcs", active.entry.drop.npcId, active.entry.drop.npcName)}>
                Source
              </Link>
              <Link
                href={entityPath(
                  "players",
                  active.entry.drop.playerId,
                  active.entry.drop.playerName,
                )}
              >
                Player
              </Link>
            </>
          ) : (
            <Link href={entityPath("groups", active.entry.group.id, active.entry.group.name)}>
              Open clan page →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
