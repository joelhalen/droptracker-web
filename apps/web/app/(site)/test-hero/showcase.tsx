"use client";

/**
 * Product showcase islands for /test-hero. Both demonstrate a feature with the
 * platform's own live output rather than a canned screenshot:
 *
 *  - `DiscordPreview` re-creates the announcement the bot posts, from whichever
 *    notable drop landed most recently — and swaps to the next one the moment
 *    it arrives over SSE.
 *  - `LiveLootboard` shows the actual PNGs the board generator writes every few
 *    minutes, for the whole platform and for the clans currently topping the
 *    month.
 */
import { useEffect, useRef, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import type { PlayerCard } from "@/lib/entity-card";
import { formatGp } from "@/lib/format";
import { entityPath } from "@/lib/slug";
import { useEventStream } from "@/lib/use-event-stream";
import {
  GLOBAL_GROUP_ID,
  LOOTBOARD_BUCKET_SECONDS,
  formatCount,
  itemIcon,
  lootboardUrl,
  npcIcon,
  toNotableDrop,
  valueTier,
  type NotableDrop,
} from "./home-data";

/* -------------------------------------------------------------------------- */
/* Discord announcement, live                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The bot's avatar. The real embeds use `/img/droptracker-small.gif`, but that
 * file is 672 KB — for a 40px circle. `/logo.gif` is the same animated mark at
 * 45 KB, and the site header has already put it in every visitor's cache.
 */
const BOT_AVATAR = "/logo.gif";

/**
 * The announced player's month total and global rank, via the BFF hover-card
 * route the rest of the site already uses. The first drop's card is resolved on
 * the server and passed in, so nothing is fetched until a new drop arrives.
 */
function usePlayerCard(playerId: number | null, seed: PlayerCard | null): PlayerCard | null {
  const cache = useRef(new Map<number, PlayerCard>(seed ? [[seed.id, seed]] : []));
  const [, bump] = useState(0);

  useEffect(() => {
    if (playerId === null || cache.current.has(playerId)) return;
    let cancelled = false;
    fetch(`/api/players/${playerId}/card`)
      .then((res) => (res.ok ? res.json() : null))
      .then((card: PlayerCard | null) => {
        if (cancelled || !card || card.kind !== "player") return;
        cache.current.set(playerId, card);
        bump((n) => n + 1);
      })
      .catch(() => {
        /* best-effort: the embed simply shows fewer lines */
      });
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  return playerId === null ? null : (cache.current.get(playerId) ?? null);
}

export function DiscordPreview({
  seed,
  seedCard,
  month,
}: {
  seed: NotableDrop | null;
  seedCard: PlayerCard | null;
  month: string;
}) {
  const [drop, setDrop] = useState<NotableDrop | null>(seed);
  const [arrivedLive, setArrivedLive] = useState(false);
  const [clock, setClock] = useState<string | null>(null);

  useEventStream(["feed"], (event) => {
    const next = toNotableDrop(event.type, event.data, event.ts);
    // Only ever move forward in time — the stream can interleave slightly.
    if (next && (!drop || next.ts >= drop.ts)) {
      setDrop(next);
      setArrivedLive(true);
    }
  });

  // A fresher seed from the server re-sync (e.g. after the tab slept).
  useEffect(() => {
    if (seed && (!drop || seed.ts > drop.ts)) setDrop(seed);
  }, [seed, drop]);

  // Wall-clock time is locale-formatted, so it is rendered after mount only —
  // the server cannot know the visitor's timezone and would mismatch.
  useEffect(() => {
    if (!drop) return;
    setClock(
      new Date(drop.ts * 1000).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
    );
  }, [drop]);

  const card = usePlayerCard(drop?.playerId ?? null, seedCard);

  if (!drop) {
    return (
      <div className="hp-dc" data-empty="true">
        <p className="hp-empty">The next 10M+ drop will be announced here as it lands.</p>
      </div>
    );
  }

  return (
    <figure className="hp-dc-figure">
      <div className="hp-dc">
        <div className="hp-dc-chan">
          <span aria-hidden>#</span> drops
        </div>
        {/* Keyed by drop so a new announcement animates in as a new message. */}
        <div className="hp-dc-msg" key={drop.key} data-live={arrivedLive}>
          <img className="hp-dc-avatar" src={BOT_AVATAR} alt="" loading="lazy" decoding="async" />
          <div className="hp-dc-main">
            <div className="hp-dc-author">
              <b>DropTracker</b>
              <span className="hp-dc-app">APP</span>
              {clock && <time>{clock}</time>}
            </div>

            {/* Field for field the default drop announcement (utils/embeds.py
                `get_global_drop_embed` in the backend repo): player as author,
                item as title, item sprite as thumbnail, value, then the
                player's month total and global rank. */}
            <div className="hp-dc-embed">
              <div className="hp-dc-embed-author">
                <img src={BOT_AVATAR} alt="" loading="lazy" decoding="async" />
                <span>{drop.playerName}</span>
              </div>
              <div className="hp-dc-embed-title">{drop.itemName}</div>
              <img className="hp-dc-embed-thumb" src={itemIcon(drop.itemId)} alt="" />

              <p>
                G/E Value: <code>{formatGp(drop.value)}</code>
              </p>
              {drop.npcName && (
                <p className="hp-dc-embed-from">
                  {drop.npcId !== null && <img src={npcIcon(drop.npcId)} alt="" loading="lazy" />}
                  from <b>{drop.npcName}</b>
                </p>
              )}

              {card && (card.total_loot || card.global_rank) && (
                <>
                  <p className="hp-dc-embed-head">Player Stats</p>
                  {card.total_loot && (
                    <p>
                      {month} Total: <code>{card.total_loot.value_formatted}</code>
                    </p>
                  )}
                  {card.global_rank !== undefined && (
                    <p>
                      Global Rank: <code>{formatCount(card.global_rank)}</code>
                      {card.ranked_players !== undefined && (
                        <>
                          {" / "}
                          <code>{formatCount(card.ranked_players)}</code>
                        </>
                      )}
                    </p>
                  )}
                </>
              )}

              <p className="hp-dc-embed-foot">
                Powered by the DropTracker | https://www.droptracker.io/
              </p>
            </div>
          </div>
        </div>
      </div>

      <figcaption>
        <span className="hp-gp" data-tier={valueTier(drop.value)}>
          ●
        </span>{" "}
        A real announcement:{" "}
        {drop.playerId !== null ? (
          <Link
            href={entityPath("players", drop.playerId, drop.playerName)}
            className="hp-link"
          >
            {drop.playerName}
          </Link>
        ) : (
          drop.playerName
        )}
        &rsquo;s {drop.itemName} is the newest 10M+ drop on DropTracker, shown the way our bot
        posts it. The next one replaces it automatically.
      </figcaption>
    </figure>
  );
}

/* -------------------------------------------------------------------------- */
/* Lootboards, live                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The board PNG is drawn at 1074px and shown narrower here, so a clan's board
 * links through to its interactive lootboard page. The platform-wide board
 * deliberately does not: that page aggregates ~26k members per uncached view
 * (seconds of backend time), which is not something to put one click away from
 * the homepage.
 */
function BoardFrame({ groupId, children }: { groupId: number; children: React.ReactNode }) {
  if (groupId === GLOBAL_GROUP_ID) return <div className="hp-board-frame">{children}</div>;
  return (
    <Link
      href={`/groups/${groupId}/lootboard` as Route}
      className="hp-board-frame"
      title="Open this clan's interactive lootboard"
    >
      {children}
    </Link>
  );
}

export interface LootboardChoice {
  groupId: number;
  label: string;
  /** Short context shown under the board — rank and month total. */
  detail: string;
}

export function LiveLootboard({
  choices,
  renderedAt,
}: {
  /** The global board first, then the clans leading the month. */
  choices: LootboardChoice[];
  renderedAt: number;
}) {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<ReadonlySet<number>>(new Set());
  const [bucket, setBucket] = useState(Math.floor(renderedAt / LOOTBOARD_BUCKET_SECONDS));

  // Step the cache-busting bucket at the cadence the generator rewrites the
  // file, so a visitor who lingers sees the board change under them.
  useEffect(() => {
    const tick = () => setBucket(Math.floor(Date.now() / 1000 / LOOTBOARD_BUCKET_SECONDS));
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  const usable = choices.filter((c) => !failed.has(c.groupId));
  const current = usable[Math.min(active, usable.length - 1)];
  if (!current) return null;

  return (
    <figure className="hp-board">
      <div className="hp-board-tabs" role="group" aria-label="Choose a lootboard">
        {usable.map((choice, i) => (
          <button
            key={choice.groupId}
            type="button"
            aria-pressed={choice.groupId === current.groupId}
            onClick={() => setActive(i)}
          >
            {choice.label}
          </button>
        ))}
      </div>

      <BoardFrame groupId={current.groupId}>
        <img
          src={lootboardUrl(current.groupId, bucket)}
          alt={`${current.label}: this month's lootboard, generated from live submissions`}
          width={1074}
          height={795}
          loading="lazy"
          decoding="async"
          // A clan whose board has never rendered has no file yet: drop its tab
          // rather than show a broken image.
          onError={() => setFailed((prev) => new Set(prev).add(current.groupId))}
        />
      </BoardFrame>

      <figcaption>
        <b>{current.label}</b> · {current.detail}
        {current.groupId !== GLOBAL_GROUP_ID && (
          <>
            {" · "}
            <Link
              href={entityPath("groups", current.groupId, current.label)}
              className="hp-link"
            >
              open clan page
            </Link>
          </>
        )}
      </figcaption>
    </figure>
  );
}
