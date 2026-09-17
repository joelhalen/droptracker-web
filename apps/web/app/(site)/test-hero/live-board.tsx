"use client";

/**
 * The "happening now" islands for /test-hero: the live activity feed, the
 * period/kind leaderboard with live overtakes, and the since-you-arrived pulse.
 *
 * Each is painted from a server snapshot and then kept current over SSE — the
 * `feed` scope for notable happenings, the `global` scope for per-drop deltas.
 * The page's periodic server re-sync (see `useServerResync`) hands fresher
 * props down; every island folds those in instead of resetting.
 */
import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useRef, useState } from "react";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { EntityChip, RankMedal } from "@/components/ui";
import { formatGp } from "@/lib/format";
import { entityPath } from "@/lib/slug";
import { useEventStream } from "@/lib/use-event-stream";
import {
  BOARD_PERIODS,
  applyDelta,
  formatAgo,
  formatCount,
  mergeFeed,
  toFeedItem,
  valueTier,
  type BoardKind,
  type BoardPeriod,
  type BoardSet,
  type FeedItem,
  type FeedLink,
} from "./home-data";
import { useNow, useServerResync } from "./live-hooks";

/* -------------------------------------------------------------------------- */
/* Server re-sync                                                             */
/* -------------------------------------------------------------------------- */

/** Invisible: re-runs the server page every couple of minutes. */
export function ServerResync({ everySeconds }: { everySeconds: number }) {
  useServerResync(everySeconds * 1000);
  return null;
}

/* -------------------------------------------------------------------------- */
/* Live feed                                                                  */
/* -------------------------------------------------------------------------- */

const FEED_ROWS = 8;
const FRESH_MS = 4_000;

const FEED_GLYPH: Record<FeedItem["kind"], string> = {
  drop: "◆",
  pet: "♥",
  personal_best: "⏱",
  new_player: "+",
  group_created: "⚑",
  subscription: "★",
};

function FeedText({ link, strong }: { link: FeedLink; strong?: boolean }) {
  const Tag = strong ? "b" : "span";
  return link.href ? (
    <Link href={link.href} className="hp-link">
      <Tag>{link.text}</Tag>
    </Link>
  ) : (
    <Tag>{link.text}</Tag>
  );
}

export function LiveFeed({ seed, renderedAt }: { seed: FeedItem[]; renderedAt: number }) {
  const [items, setItems] = useState(() => seed.slice(0, FEED_ROWS));
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const now = useNow(renderedAt);

  // Server re-sync: back-fills anything the stream missed (sleep, reconnect).
  useEffect(() => {
    setItems((prev) => mergeFeed(prev, seed, FEED_ROWS));
  }, [seed]);

  const { state } = useEventStream(["feed"], (event) => {
    const item = toFeedItem(event.type, event.data, event.ts);
    if (!item) return;
    setItems((prev) => mergeFeed(prev, [item], FEED_ROWS));
    setFresh((prev) => new Set(prev).add(item.key));
    setTimeout(() => {
      setFresh((prev) => {
        const next = new Set(prev);
        next.delete(item.key);
        return next;
      });
    }, FRESH_MS);
  });

  return (
    <section className="hp-panel" aria-labelledby="hp-feed-title">
      <header className="hp-panel-head">
        <h3 id="hp-feed-title">Notable, as it happens</h3>
        <span className="hp-stream" data-state={state}>
          <i aria-hidden />
          {state === "open" ? "streaming" : state === "connecting" ? "connecting" : "offline"}
        </span>
      </header>

      {items.length === 0 ? (
        <p className="hp-empty">Waiting for the next big drop…</p>
      ) : (
        <ol className="hp-feed-list">
          {items.map((item) => (
            <li
              key={item.key}
              className="hp-feed-row"
              data-kind={item.kind}
              data-fresh={fresh.has(item.key)}
            >
              <span className="hp-feed-icon" data-icon={item.iconKind} aria-hidden>
                {item.iconUrl ? (
                  <img src={item.iconUrl} alt="" loading="lazy" decoding="async" />
                ) : (
                  FEED_GLYPH[item.kind]
                )}
              </span>

              <span className="hp-feed-body">
                <span className="hp-feed-line">
                  <FeedText link={item.who} strong /> {item.verb}{" "}
                  {item.what && (
                    <span className="hp-feed-what">
                      <FeedText link={item.what} />
                    </span>
                  )}
                </span>
                {(item.where || item.note) && (
                  <span className="hp-feed-sub">
                    {item.where && <FeedText link={item.where} />}
                    {item.where && item.note && " · "}
                    {item.note}
                  </span>
                )}
              </span>

              <span className="hp-feed-side">
                {item.value !== null && (
                  <span className="hp-gp" data-tier={valueTier(item.value)}>
                    {formatGp(item.value)}
                  </span>
                )}
                <time dateTime={new Date(item.ts * 1000).toISOString()}>
                  {formatAgo(item.ts, now)}
                </time>
              </span>
            </li>
          ))}
        </ol>
      )}

      <footer className="hp-panel-foot">
        <span>Drops of 10M+, pets, top-25 personal bests and new arrivals</span>
      </footer>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Leaderboard                                                                */
/* -------------------------------------------------------------------------- */

/** Row height in px — rows are absolutely placed so an overtake can animate. */
const ROW_PX = 44;
const DELTA_BADGE_MS = 2_600;

const KINDS: { key: BoardKind; label: string; noun: string; tab: string }[] = [
  { key: "players", label: "Players", noun: "players", tab: "players" },
  { key: "clans", label: "Clans", noun: "clans", tab: "groups" },
];

export function Leaderboard({ boards }: { boards: BoardSet }) {
  const [period, setPeriod] = useState<BoardPeriod>("day");
  const [kind, setKind] = useState<BoardKind>("players");
  const [live, setLive] = useState(boards);
  const [deltas, setDeltas] = useState<ReadonlyMap<number, number>>(new Map());

  // Server re-sync is the authority: it carries clan totals and anyone who has
  // climbed into a top-N from below it, neither of which the stream can tell us.
  useEffect(() => {
    setLive(boards);
  }, [boards]);

  // Ids on any player board, so the ~7 frames a second about everybody else
  // never reach React state at all.
  const tracked = useMemo(() => {
    const ids = new Set<number>();
    for (const p of BOARD_PERIODS) for (const r of live[p.key].players.rows) ids.add(r.id);
    return ids;
  }, [live]);
  const trackedRef = useRef(tracked);
  trackedRef.current = tracked;

  const { state } = useEventStream(["global"], (event) => {
    if (event.type !== "leaderboard_delta") return;
    const id = Number(event.data.id);
    const delta = Number(event.data.delta ?? 0);
    if (!Number.isInteger(id) || !Number.isFinite(delta) || delta <= 0) return;
    if (!trackedRef.current.has(id)) return;

    // One drop counts towards today, this week AND this month.
    setLive((prev) => {
      const next = { ...prev };
      for (const p of BOARD_PERIODS) {
        const board = prev[p.key];
        const rows = applyDelta(board.players.rows, id, delta);
        if (rows !== board.players.rows) {
          next[p.key] = { ...board, players: { ...board.players, rows } };
        }
      }
      return next;
    });
    setDeltas((prev) => new Map(prev).set(id, (prev.get(id) ?? 0) + delta));
    setTimeout(() => {
      setDeltas((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }, DELTA_BADGE_MS);
  });

  const board = live[period][kind];
  const phrase = BOARD_PERIODS.find((p) => p.key === period)!.phrase;
  const meta = KINDS.find((k) => k.key === kind)!;
  const max = board.rows.reduce((m, r) => Math.max(m, r.value), 0);

  // DOM order is pinned to id, and rank only moves a row's transform. If the
  // nodes themselves were re-ordered React would re-insert them, which drops
  // the transition and the overtake would just blink into place.
  const placed = useMemo(
    () =>
      board.rows
        .map((row, index) => ({ row, index }))
        .sort((a, b) => a.row.id - b.row.id),
    [board.rows],
  );

  return (
    <section className="hp-panel" aria-labelledby="hp-lb-title">
      <header className="hp-panel-head">
        <h3 id="hp-lb-title">Top loot</h3>
        <span className="hp-stream" data-state={state}>
          <i aria-hidden />
          {kind === "players" ? "live per drop" : "refreshes every 2 min"}
        </span>
      </header>

      <div className="hp-lb-controls">
        <div className="hp-seg" role="group" aria-label="Leaderboard period">
          {BOARD_PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={period === p.key}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="hp-seg" role="group" aria-label="Players or clans">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              aria-pressed={kind === k.key}
              onClick={() => setKind(k.key)}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {board.rows.length === 0 ? (
        <p className="hp-empty">Nobody is on this board yet — it fills as drops are tracked.</p>
      ) : (
        <ol className="hp-lb-rows" style={{ height: board.rows.length * ROW_PX }}>
          {placed.map(({ row, index }) => {
            const delta = kind === "players" ? deltas.get(row.id) : undefined;
            return (
              <li
                key={row.id}
                className="hp-lb-row"
                data-top={index === 0}
                data-hit={delta !== undefined}
                aria-posinset={index + 1}
                aria-setsize={board.rows.length}
                style={{ transform: `translateY(${index * ROW_PX}px)`, height: ROW_PX }}
              >
                <span
                  className="hp-lb-bar"
                  aria-hidden
                  style={{ width: `${max > 0 ? Math.max(3, (row.value / max) * 100) : 0}%` }}
                />
                <RankMedal rank={row.rank} className="hp-lb-rank" />
                <EntityHoverCard
                  kind={kind === "players" ? "player" : "group"}
                  id={row.id}
                  name={row.name}
                  seed={{
                    rank: row.rank,
                    loot: formatGp(row.value),
                    periodLabel: phrase,
                    badges: row.badges,
                  }}
                  className="hp-lb-name"
                >
                  <EntityChip
                    href={entityPath(kind === "players" ? "players" : "groups", row.id, row.name)}
                    name={row.name}
                    size="sm"
                    flair={row.flair}
                    flairTitle={row.flairTitle}
                    playerId={kind === "players" ? row.id : undefined}
                  />
                </EntityHoverCard>
                <span className="hp-lb-value">
                  {formatGp(row.value)}
                  {delta !== undefined && <i className="hp-lb-delta">+{formatGp(delta)}</i>}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <footer className="hp-panel-foot">
        <span>
          <b>{formatCount(board.ranked)}</b> {meta.noun} ranked {phrase}
        </span>
        <Link href={`/leaderboards?tab=${meta.tab}&period=${period}` as Route} className="hp-more">
          Full leaderboards →
        </Link>
      </footer>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Since you arrived                                                          */
/* -------------------------------------------------------------------------- */

/** Seconds of history in the sparkline. */
const SPARK_SECONDS = 60;

interface SessionStats {
  drops: number;
  gp: number;
  players: number;
  biggest: { value: number; name: string } | null;
  series: number[];
}

/**
 * Everything here is counted in the visitor's own browser from the moment the
 * page opened — it is the one part of the page that is theirs alone, and the
 * quickest way to show that the numbers above are not a recording.
 */
export function SessionPulse() {
  const acc = useRef({
    drops: 0,
    gp: 0,
    players: new Set<number>(),
    biggest: null as SessionStats["biggest"],
    thisSecond: 0,
  });
  const [stats, setStats] = useState<SessionStats>({
    drops: 0,
    gp: 0,
    players: 0,
    biggest: null,
    series: [],
  });

  const { state } = useEventStream(["global"], (event) => {
    if (event.type !== "leaderboard_delta") return;
    const delta = Number(event.data.delta ?? 0);
    if (!Number.isFinite(delta) || delta <= 0) return;
    const a = acc.current;
    a.drops += 1;
    a.gp += delta;
    a.thisSecond += 1;
    const id = Number(event.data.id);
    if (Number.isInteger(id)) a.players.add(id);
    if (!a.biggest || delta > a.biggest.value) {
      const name = typeof event.data.name === "string" && event.data.name ? event.data.name : "someone";
      a.biggest = { value: delta, name };
    }
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const a = acc.current;
      setStats((prev) => ({
        drops: a.drops,
        gp: a.gp,
        players: a.players.size,
        biggest: a.biggest,
        series: [...prev.series, a.thisSecond].slice(-SPARK_SECONDS),
      }));
      a.thisSecond = 0;
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const peak = Math.max(4, ...stats.series);

  return (
    <section className="hp-panel" aria-labelledby="hp-session-title">
      <header className="hp-panel-head">
        <h3 id="hp-session-title">Since you arrived</h3>
        <span className="hp-stream" data-state={state}>
          <i aria-hidden />
          counted in your browser
        </span>
      </header>

      <dl className="hp-session-stats">
        <div>
          <dt>Drops tracked</dt>
          <dd>{formatCount(stats.drops)}</dd>
        </div>
        <div>
          <dt>Worth</dt>
          <dd>
            {formatGp(stats.gp)} <small>gp</small>
          </dd>
        </div>
        <div>
          <dt>Players looting</dt>
          <dd>{formatCount(stats.players)}</dd>
        </div>
        <div>
          <dt>Biggest so far</dt>
          <dd>
            {stats.biggest ? (
              <>
                <span className="hp-gp" data-tier={valueTier(stats.biggest.value)}>
                  {formatGp(stats.biggest.value)}
                </span>{" "}
                <small>{stats.biggest.name}</small>
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      {/* One bar per second, newest on the right; the strip fills as you watch. */}
      <div className="hp-spark" aria-hidden>
        {Array.from({ length: SPARK_SECONDS }, (_, i) => {
          const value = stats.series[i - (SPARK_SECONDS - stats.series.length)];
          return (
            <i
              key={i}
              style={{ height: value === undefined ? 0 : `${Math.max(6, (value / peak) * 100)}%` }}
            />
          );
        })}
      </div>
      <p className="hp-spark-label">drops per second, last minute</p>
    </section>
  );
}
