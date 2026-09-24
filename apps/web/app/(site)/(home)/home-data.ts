/**
 * Pure data shaping for the homepage.
 *
 * Deliberately NOT a "use client" module. The page shapes its first paint on
 * the SERVER (feed history, leaderboards, status counters) and the client
 * islands re-use the exact same functions for SSE frames — so everything here
 * must be importable from both environments. A helper that lives in a
 * "use client" file becomes a client-reference proxy on the server and throws
 * the moment it is called (test/home-boundary.test.ts guards this).
 *
 * Nothing in this file is curated or hard-coded content: every function takes a
 * live API payload or a realtime envelope and returns a display shape.
 */
import type { Route } from "next";
import type {
  CompactBadge,
  EventSummary,
  LeaderboardPage,
  TierFlairStyle,
} from "@droptracker/api-types";
import type { StatusSummary } from "@/lib/known-issues";
import { entityPath } from "@/lib/slug";

/**
 * The DropTracker global group. Every tracked account belongs to it, so its
 * profile is the honest source for "GP tracked this month", "accounts tracked",
 * the platform-wide top bosses and the newest records.
 */
export const GLOBAL_GROUP_ID = 2;

/*
 * Relative `/img`, like the rest of the site (see `playerAvatarUrl` in
 * components/ui.tsx): nginx proxies `/img/` to the image server on every host
 * that serves this app, so one relative path is right everywhere.
 */
export const itemIcon = (id: number) => `/img/itemdb/${id}.png`;
export const npcIcon = (id: number) => `/img/npcdb/${id}.png`;

/**
 * A clan's live lootboard PNG. The board generator rewrites this file every few
 * minutes, so `bucket` (a coarse timestamp) is appended purely to step past
 * browser/CDN caches at about the same cadence the file actually changes.
 */
export const lootboardUrl = (groupId: number, bucket: number) =>
  `/img/clans/${groupId}/lb/lootboard.png?t=${bucket}`;

/** How often a lootboard URL's cache bucket rolls over, in seconds. */
export const LOOTBOARD_BUCKET_SECONDS = 180;

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Integer with thousands separators, pinned to en-US.
 *
 * A bare `toLocaleString()` formats with the SERVER's locale during SSR and the
 * visitor's locale on hydration ("26,442" vs "26.442"), which React reports as
 * a hydration mismatch. Every count on this page goes through here instead.
 */
export function formatCount(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** Compact relative age: "now", "42s", "3m", "2h", "5d". */
export function formatAgo(ts: number, nowSeconds: number): string {
  const diff = Math.max(0, Math.floor(nowSeconds - ts));
  if (diff < 10) return "now";
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86_400)}d`;
}

/** "3h 12m" / "2d 4h" until a unix timestamp; null once it has passed. */
export function formatCountdown(untilTs: number, nowSeconds: number): string | null {
  const diff = Math.floor(untilTs - nowSeconds);
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86_400);
  const hours = Math.floor((diff % 86_400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

/** English month name for a date, in UTC — the tracking month is a UTC month. */
export function monthName(date: Date): string {
  return date.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
}

/* -------------------------------------------------------------------------- */
/* Value tiers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Rarity bucket for a GP value. The four named tiers use the same thresholds as
 * `lootValueClass` (lib/format.ts) so a colour means the same thing here as on
 * a lootboard; "common" and "dust" only exist to grade the hero's rain, where
 * most drops are worth a few hundred gp.
 */
export type ValueTier = "dust" | "common" | "1m" | "10m" | "100m" | "1b";

export function valueTier(value: number): ValueTier {
  if (value >= 1_000_000_000) return "1b";
  if (value >= 100_000_000) return "100m";
  if (value >= 10_000_000) return "10m";
  if (value >= 1_000_000) return "1m";
  if (value >= 50_000) return "common";
  return "dust";
}

/**
 * 0..1 visual weight for a drop in the rain, on a log scale.
 *
 * Live values span nine orders of magnitude (a 60 gp bone to a 1.4B bow), so
 * anything linear renders as a flat line with a single spike. log10 puts
 * 100 gp near 0.1, 1M at ~0.6 and 1B at 1.
 */
export function rainWeight(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const w = (Math.log10(value) - 1) / 8;
  return Math.min(1, Math.max(0.04, w));
}

/* -------------------------------------------------------------------------- */
/* Odometer                                                                   */
/* -------------------------------------------------------------------------- */

export interface OdometerCell {
  /**
   * Stable identity counted from the RIGHT ("d0" is the ones digit), so a cell
   * keeps its React key — and its roll animation state — when the number grows
   * a digit on the left.
   */
  key: string;
  char: string;
  kind: "digit" | "sep";
}

/** Split a whole number into digit and thousands-separator cells. */
export function odometerCells(value: number): OdometerCell[] {
  const digits = String(Math.max(0, Math.floor(value)));
  const cells: OdometerCell[] = [];
  for (let i = 0; i < digits.length; i++) {
    const fromRight = digits.length - 1 - i;
    cells.push({ key: `d${fromRight}`, char: digits[i]!, kind: "digit" });
    if (fromRight > 0 && fromRight % 3 === 0) {
      cells.push({ key: `s${fromRight}`, char: ",", kind: "sep" });
    }
  }
  return cells;
}

/* -------------------------------------------------------------------------- */
/* Realtime feed                                                              */
/* -------------------------------------------------------------------------- */

export type FeedKind =
  | "drop"
  | "pet"
  | "personal_best"
  | "new_player"
  | "group_created"
  | "subscription";

export interface FeedLink {
  text: string;
  href: Route | null;
}

/** One row of the live activity list: <who> <verb> <what> · <where>. */
export interface FeedItem {
  /** Stable across the server seed and SSE, so merging the two never doubles a row. */
  key: string;
  kind: FeedKind;
  ts: number;
  who: FeedLink;
  verb: string;
  what: FeedLink | null;
  where: FeedLink | null;
  /** Small trailing detail — team size, board rank. */
  note: string | null;
  iconUrl: string | null;
  /** Item sprites are 36×32 pixel art; NPC renders are 280×280 paintings. */
  iconKind: "item" | "npc" | "none";
  value: number | null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** A positive integer id (item, NPC, group), or null. */
function entityId(v: unknown): number | null {
  const n = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Player ids are taken as any integer rather than "positive only". User ids on
 * this platform run to 0 and below, and a `> 0` guard there once silently
 * dropped a real account; player ids start higher today, but nothing here needs
 * the stricter test, so it does not make the same bet.
 */
function playerId(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) ? v : null;
}

function playerLink(data: Record<string, unknown>): FeedLink {
  const name = str(data.player_name) ?? "Someone";
  const id = playerId(data.player_id);
  return { text: name, href: id === null ? null : entityPath("players", id, name) };
}

/**
 * Normalise one realtime envelope (`services/realtime.py` publishes a `type`
 * plus display-ready `data`) into a feed row. Unknown types and malformed
 * payloads return null so callers can simply filter.
 */
export function toFeedItem(
  type: string,
  data: Record<string, unknown>,
  envelopeTs: number,
): FeedItem | null {
  const ts = num(data.ts) ?? envelopeTs;

  switch (type) {
    case "drop": {
      const value = num(data.value);
      if (value === null || value <= 0) return null;
      const itemId = entityId(data.item_id);
      const itemName = str(data.item_name) ?? "an item";
      const npcId = entityId(data.npc_id);
      const npcName = str(data.npc_name);
      return {
        key: `drop:${ts}:${playerId(data.player_id) ?? "?"}:${itemId ?? itemName}`,
        kind: "drop",
        ts,
        who: playerLink(data),
        verb: "received",
        what: {
          text: itemName,
          href: itemId === null ? null : entityPath("items", itemId, itemName),
        },
        where: npcName
          ? { text: npcName, href: npcId === null ? null : entityPath("npcs", npcId, npcName) }
          : null,
        note: null,
        iconUrl: str(data.icon_url) ?? (itemId === null ? null : itemIcon(itemId)),
        iconKind: "item",
        value,
      };
    }

    case "pet": {
      const petName = str(data.pet_name) ?? "a pet";
      const itemId = entityId(data.item_id);
      const npcName = str(data.npc_name);
      return {
        key: `pet:${ts}:${playerId(data.player_id) ?? "?"}:${petName}`,
        kind: "pet",
        ts,
        who: playerLink(data),
        verb: "got a pet:",
        what: {
          text: petName,
          href: itemId === null ? null : entityPath("items", itemId, petName),
        },
        where: npcName ? { text: npcName, href: null } : null,
        note: null,
        iconUrl: str(data.icon_url) ?? (itemId === null ? null : itemIcon(itemId)),
        iconKind: "item",
        value: null,
      };
    }

    case "personal_best": {
      const npcName = str(data.npc_name);
      const time = str(data.time_display);
      if (!npcName || !time) return null;
      const npcId = entityId(data.npc_id);
      const team = str(data.team_size);
      const rank = num(data.rank);
      const note = [team, rank !== null ? `rank #${rank}` : null].filter(Boolean).join(" · ");
      return {
        key: `pb:${ts}:${playerId(data.player_id) ?? "?"}:${npcId ?? npcName}`,
        kind: "personal_best",
        ts,
        who: playerLink(data),
        verb: "set a personal best of",
        what: { text: time, href: null },
        where: {
          text: npcName,
          href: npcId === null ? null : entityPath("npcs", npcId, npcName),
        },
        note: note || null,
        iconUrl: str(data.npc_icon_url) ?? (npcId === null ? null : npcIcon(npcId)),
        iconKind: "npc",
        value: null,
      };
    }

    case "new_player": {
      const name = str(data.player_name);
      if (!name) return null;
      const n = num(data.player_number);
      return {
        key: `new:${ts}:${playerId(data.player_id) ?? name}`,
        kind: "new_player",
        ts,
        who: playerLink(data),
        verb: "started tracking",
        what: n !== null ? { text: `account #${formatCount(n)}`, href: null } : null,
        where: null,
        note: null,
        iconUrl: null,
        iconKind: "none",
        value: null,
      };
    }

    case "group_created": {
      const name = str(data.group_name);
      if (!name) return null;
      const id = entityId(data.group_id);
      return {
        key: `clan:${ts}:${id ?? name}`,
        kind: "group_created",
        ts,
        who: { text: name, href: id === null ? null : entityPath("groups", id, name) },
        verb: "registered as a new clan",
        what: null,
        where: null,
        note: null,
        iconUrl: null,
        iconKind: "none",
        value: null,
      };
    }

    case "subscription": {
      const name = str(data.name);
      if (!name) return null;
      const isGroup = data.kind === "group";
      const id = isGroup ? entityId(data.group_id) : playerId(data.player_id);
      return {
        key: `sub:${ts}:${isGroup ? "g" : "p"}:${id ?? name}`,
        kind: "subscription",
        ts,
        who: {
          text: name,
          href: id === null ? null : entityPath(isGroup ? "groups" : "players", id, name),
        },
        verb: "became a supporter",
        what: null,
        where: null,
        note: null,
        iconUrl: null,
        iconKind: "none",
        value: null,
      };
    }

    default:
      return null;
  }
}

/**
 * Fold freshly arrived rows into an existing list: newest first, de-duplicated
 * by key, capped. Used both for SSE frames (one row) and for the periodic
 * server re-sync (a whole page), which is what back-fills anything missed while
 * a laptop slept or the stream reconnected.
 */
export function mergeFeed(existing: FeedItem[], incoming: FeedItem[], max: number): FeedItem[] {
  const seen = new Set<string>();
  const merged: FeedItem[] = [];
  for (const item of [...incoming, ...existing]) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    merged.push(item);
  }
  // Stable for equal timestamps, so an SSE row stays above the seed it landed on.
  merged.sort((a, b) => b.ts - a.ts);
  return merged.slice(0, max);
}

/* -------------------------------------------------------------------------- */
/* Notable drops (hero highlight reel + the Discord preview)                  */
/* -------------------------------------------------------------------------- */

/**
 * Minimum GP for a drop to count as "notable".
 *
 * Not arbitrary: `services/realtime.py` uses the same bar (`FEED_MIN_DROP_VALUE`)
 * to decide what reaches the `feed` scope at all, so this agrees with the
 * stream instead of discarding part of it.
 */
export const NOTABLE_GP = 10_000_000;

export interface NotableDrop {
  key: string;
  itemId: number;
  itemName: string;
  npcId: number | null;
  npcName: string | null;
  playerId: number | null;
  playerName: string;
  value: number;
  ts: number;
}

/** Pull a notable drop out of a realtime envelope, or null. */
export function toNotableDrop(
  type: string,
  data: Record<string, unknown>,
  envelopeTs: number,
): NotableDrop | null {
  if (type !== "drop") return null;
  const itemId = entityId(data.item_id);
  const value = num(data.value);
  if (itemId === null || value === null || value < NOTABLE_GP) return null;
  const ts = num(data.ts) ?? envelopeTs;
  const pid = playerId(data.player_id);
  return {
    key: `drop:${ts}:${pid ?? "?"}:${itemId}`,
    itemId,
    itemName: str(data.item_name) ?? "an item",
    npcId: entityId(data.npc_id),
    npcName: str(data.npc_name),
    playerId: pid,
    playerName: str(data.player_name) ?? "Someone",
    value,
    ts,
  };
}

/** Newest-first notable drops out of a feed history page. */
export function notableDrops(
  feed: { type: string; data: Record<string, unknown> }[],
  max: number,
): NotableDrop[] {
  const seen = new Set<string>();
  return feed
    .map((e) => toNotableDrop(e.type, e.data, 0))
    .filter((d): d is NotableDrop => d !== null && d.ts > 0)
    .filter((d) => (seen.has(d.key) ? false : (seen.add(d.key), true)))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, max);
}

/* -------------------------------------------------------------------------- */
/* Leaderboards                                                               */
/* -------------------------------------------------------------------------- */

export type BoardPeriod = "day" | "week" | "month";
export type BoardKind = "players" | "clans";

export const BOARD_PERIODS: { key: BoardPeriod; label: string; phrase: string }[] = [
  { key: "day", label: "Today", phrase: "today" },
  { key: "week", label: "This week", phrase: "this week" },
  { key: "month", label: "This month", phrase: "this month" },
];

export interface BoardRow {
  id: number;
  name: string;
  rank: number;
  value: number;
  flair?: TierFlairStyle;
  flairTitle?: string;
  badges?: CompactBadge[];
}

export interface Board {
  rows: BoardRow[];
  /** How many players/clans are ranked for the period in total. */
  ranked: number;
}

export type BoardSet = Record<BoardPeriod, Record<BoardKind, Board>>;

export const EMPTY_BOARD: Board = { rows: [], ranked: 0 };

export function toBoard(page: LeaderboardPage | null): Board {
  if (!page) return EMPTY_BOARD;
  return {
    ranked: page.meta.total,
    rows: page.entries.map((e) => ({
      id: e.id,
      name: e.name,
      rank: e.rank,
      value: e.loot.value,
      flair: e.flair?.style,
      flairTitle: e.flair?.tier_name,
      badges: e.badges,
    })),
  };
}

/**
 * Apply one live `leaderboard_delta` to a board's rows.
 *
 * Returns the SAME array when the player is not on this board (so callers can
 * bail out of a re-render by identity), otherwise a new array re-sorted by
 * value with ranks renumbered — a drop can carry someone past the row above,
 * and the list animates that overtake.
 *
 * Ranks are renumbered from the top row's rank rather than from 1 so a board
 * that does not start at #1 would stay correct; ties keep their prior order.
 */
export function applyDelta(rows: BoardRow[], id: number, delta: number): BoardRow[] {
  if (!Number.isFinite(delta) || delta <= 0) return rows;
  const index = rows.findIndex((r) => r.id === id);
  if (index === -1) return rows;

  const firstRank = rows[0]?.rank ?? 1;
  const next = rows.map((r, i) => (i === index ? { ...r, value: r.value + delta } : r));
  next.sort((a, b) => b.value - a.value);
  return next.map((r, i) => ({ ...r, rank: firstRank + i }));
}

/* -------------------------------------------------------------------------- */
/* Platform status                                                            */
/* -------------------------------------------------------------------------- */

/** How the "players online" window is described next to the figure. */
export const ONLINE_WINDOW_LABEL = "last 5 mins";

export interface PlatformPulse {
  state: "operational" | "degraded" | "offline";
  /** Submissions of every type processed in the trailing windows (both intake paths). */
  processed24h: number;
  processed30m: number;
  processed5m: number;
  /**
   * Distinct players a submission was processed for in the last five minutes,
   * or null when the backend predates the figure (then nothing is shown).
   */
  playersOnline: number | null;
  /** Open known issues staff have published. */
  openIssues: number;
  generatedAt: number;
}

/**
 * Collapse `GET /status` into the handful of numbers the page shows.
 *
 * Two intake paths feed the platform — the plugin API and the legacy
 * Discord-webhook reader — and a visitor does not care which one a submission
 * took, so their counters are summed. The plugin API is the one that matters
 * for "is it working": the webhook reader being down alone reads as degraded,
 * not offline.
 *
 * Players online is the exception to "summed": it is a headcount, so the
 * backend de-duplicates it across both paths and sends one number. Adding the
 * two per-path `players_1h` figures, as this used to, counts anyone seen on
 * both paths twice.
 */
export function toPlatformPulse(summary: StatusSummary | null): PlatformPulse | null {
  if (!summary) return null;
  const { api, webhook, generated_at, players_5m } = summary.services;
  // All-zero counters are the API client's "backend unreachable" placeholder
  // (EMPTY_STATUS_SUMMARY), not a quiet day — there is nothing honest to show.
  if (generated_at === 0) return null;

  const state: PlatformPulse["state"] = !api.online
    ? "offline"
    : api.status !== "operational" || !webhook.online
      ? "degraded"
      : "operational";

  return {
    state,
    processed24h: api.processed["24h"] + webhook.processed["24h"],
    processed30m: api.processed["30m"] + webhook.processed["30m"],
    processed5m: api.processed["5m"] + webhook.processed["5m"],
    playersOnline: players_5m ?? null,
    openIssues: summary.categories.reduce(
      (n, c) => n + c.issues.filter((i) => i.status !== "resolved").length,
      0,
    ),
    generatedAt: generated_at,
  };
}

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

export const EVENT_KIND_LABEL: Record<EventSummary["kind"], string> = {
  standard: "Task race",
  bingo: "Bingo",
  board_game: "Board game",
  loot_sweep: "Loot sweep",
  sotw: "Skill of the Week",
  botw: "Boss of the Week",
  conquest: "Conquest",
};

/**
 * Public events that are running right now, soonest-ending first.
 *
 * `status === "active"` alone is not enough: an event stays "active" until the
 * lifecycle sweep closes it, so one whose end time has passed is filtered here
 * rather than advertised as live for a few more minutes.
 */
export function liveEvents(
  events: EventSummary[],
  nowSeconds: number,
  max: number,
): EventSummary[] {
  return events
    .filter((e) => e.status === "active" && e.visibility === "public")
    .filter((e) => e.ends_at === null || e.ends_at > nowSeconds)
    .filter((e) => e.starts_at === null || e.starts_at <= nowSeconds)
    .sort((a, b) => (a.ends_at ?? Infinity) - (b.ends_at ?? Infinity))
    .slice(0, max);
}
