/**
 * Shaping behind the /test-hero homepage candidate (app/(site)/test-hero/
 * home-data.ts). The envelopes below are real frames captured from the
 * production `feed` and `global` scopes, trimmed only of nothing.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { EventSummary, LeaderboardPage } from "@droptracker/api-types";
import { EventSummarySchema } from "@droptracker/api-types";
import { EMPTY_STATUS_SUMMARY, type StatusSummary } from "../lib/known-issues";
import {
  NOTABLE_GP,
  applyDelta,
  formatAgo,
  formatCount,
  formatCountdown,
  liveEvents,
  mergeFeed,
  monthName,
  notableDrops,
  odometerCells,
  rainWeight,
  toBoard,
  toFeedItem,
  toNotableDrop,
  toPlatformPulse,
  valueTier,
  type BoardRow,
  type FeedItem,
} from "../app/(site)/test-hero/home-data";

const DROP = {
  icon_url: "https://www.droptracker.io/img/itemdb/26243.png",
  item_id: 26243,
  item_name: "Virtus robe top",
  npc_icon_url: "https://www.droptracker.io/img/npcdb/12214.png",
  npc_id: 12214,
  npc_name: "The Leviathan",
  player_id: 5755136,
  player_name: "x swifty",
  ts: 1789656870,
  value: 30980428,
  value_formatted: "30.98M",
};

const PERSONAL_BEST = {
  npc_icon_url: "https://www.droptracker.io/img/npcdb/12214.png",
  npc_id: 12214,
  npc_name: "Leviathan",
  player_id: 5767158,
  player_name: "budzx",
  rank: 14,
  team_size: "Solo",
  time_display: "0:52.2",
  time_ms: 52200,
  ts: 1789647129,
};

/* -------------------------------------------------------------------------- */
/* Feed                                                                       */
/* -------------------------------------------------------------------------- */

test("toFeedItem shapes a drop with links to the player, item and source", () => {
  const item = toFeedItem("drop", DROP, 0);
  assert.ok(item);
  assert.equal(item.kind, "drop");
  assert.equal(item.ts, 1789656870);
  assert.deepEqual(item.who, { text: "x swifty", href: "/players/x-swifty" });
  assert.deepEqual(item.what, { text: "Virtus robe top", href: "/items/virtus-robe-top" });
  assert.deepEqual(item.where, { text: "The Leviathan", href: "/npcs/the-leviathan" });
  assert.equal(item.value, 30980428);
  assert.equal(item.iconKind, "item");
});

test("toFeedItem covers every type the feed scope publishes", () => {
  const pb = toFeedItem("personal_best", PERSONAL_BEST, 0);
  assert.equal(pb?.what?.text, "0:52.2");
  assert.equal(pb?.where?.text, "Leviathan");
  assert.equal(pb?.note, "Solo · rank #14");
  assert.equal(pb?.iconKind, "npc");

  const pet = toFeedItem(
    "pet",
    { item_id: 13177, pet_name: "Venenatis spiderling", npc_name: "Venenatis", player_id: 1, player_name: "climbersone", ts: 5 },
    0,
  );
  assert.equal(pet?.what?.text, "Venenatis spiderling");
  assert.equal(pet?.iconUrl, "/img/itemdb/13177.png", "falls back to the item sprite");

  const fresh = toFeedItem(
    "new_player",
    { player_id: 5767726, player_name: "iron redpot", player_number: 26439, ts: 5 },
    0,
  );
  assert.equal(fresh?.what?.text, "account #26,439");

  const clan = toFeedItem("group_created", { group_id: 350, group_name: "DivineRS", ts: 5 }, 0);
  assert.deepEqual(clan?.who, { text: "DivineRS", href: "/groups/diviners" });

  const sub = toFeedItem("subscription", { kind: "group", name: "Umbral", group_id: 123, ts: 5 }, 0);
  assert.equal(sub?.who.href, "/groups/umbral");
});

test("toFeedItem rejects what it cannot render", () => {
  assert.equal(toFeedItem("leaderboard_delta", { id: 1, delta: 5 }, 0), null, "not a feed type");
  assert.equal(toFeedItem("drop", { ...DROP, value: 0 }, 0), null, "a worthless drop");
  assert.equal(toFeedItem("personal_best", { ...PERSONAL_BEST, time_display: "" }, 0), null);
  assert.equal(toFeedItem("group_created", { group_id: 1 }, 0), null, "a clan with no name");
});

test("toFeedItem uses the envelope timestamp when the payload has none", () => {
  const { ts: _ts, ...withoutTs } = DROP;
  assert.equal(toFeedItem("drop", withoutTs, 1234)?.ts, 1234);
});

test("mergeFeed de-duplicates the SSE copy of a row the server already sent", () => {
  const seeded = toFeedItem("drop", DROP, 0)!;
  const streamed = toFeedItem("drop", { ...DROP }, 1789656870)!;
  assert.equal(seeded.key, streamed.key, "same drop, same key, whichever path delivered it");

  const older = toFeedItem("personal_best", PERSONAL_BEST, 0)!;
  const merged = mergeFeed([seeded, older], [streamed], 8);
  assert.deepEqual(
    merged.map((i) => i.kind),
    ["drop", "personal_best"],
  );
});

test("mergeFeed keeps newest first and honours the cap", () => {
  const rows: FeedItem[] = [10, 30, 20].map(
    (ts) => toFeedItem("drop", { ...DROP, ts, player_id: ts }, 0)!,
  );
  const merged = mergeFeed(rows.slice(0, 2), [rows[2]!], 2);
  assert.deepEqual(
    merged.map((i) => i.ts),
    [30, 20],
  );
});

/* -------------------------------------------------------------------------- */
/* Notable drops                                                              */
/* -------------------------------------------------------------------------- */

test("toNotableDrop honours the same bar the feed scope publishes at", () => {
  assert.equal(NOTABLE_GP, 10_000_000);
  const drop = toNotableDrop("drop", DROP, 0);
  assert.equal(drop?.itemId, 26243);
  assert.equal(drop?.playerId, 5755136);
  assert.equal(drop?.key, toFeedItem("drop", DROP, 0)?.key, "one key space for both shapes");

  assert.equal(toNotableDrop("pet", DROP, 0), null, "only drops are notable");
  assert.equal(toNotableDrop("drop", { ...DROP, value: NOTABLE_GP - 1 }, 0), null);
  assert.equal(toNotableDrop("drop", { ...DROP, item_id: 0 }, 0), null, "no sprite to show");
});

test("notableDrops returns the newest first, without repeats", () => {
  const feed = [
    { type: "drop", data: { ...DROP, ts: 100 } },
    { type: "pet", data: { pet_name: "Olmlet", player_name: "a", ts: 300 } },
    { type: "drop", data: { ...DROP, ts: 200, item_id: 20997, item_name: "Twisted bow" } },
    { type: "drop", data: { ...DROP, ts: 100 } },
  ];
  assert.deepEqual(
    notableDrops(feed, 5).map((d) => d.itemName),
    ["Twisted bow", "Virtus robe top"],
  );
  assert.equal(notableDrops(feed, 1).length, 1);
});

/* -------------------------------------------------------------------------- */
/* Tiers, rain, odometer                                                      */
/* -------------------------------------------------------------------------- */

test("valueTier matches the lootboard thresholds", () => {
  assert.equal(valueTier(243), "dust");
  assert.equal(valueTier(87_930), "common");
  assert.equal(valueTier(1_000_000), "1m");
  assert.equal(valueTier(30_980_428), "10m");
  assert.equal(valueTier(352_789_765), "100m");
  assert.equal(valueTier(1_489_000_000), "1b");
});

test("rainWeight spreads nine orders of magnitude across 0..1", () => {
  assert.equal(rainWeight(0), 0);
  assert.equal(rainWeight(-5), 0);
  assert.equal(rainWeight(Number.NaN), 0);
  assert.ok(rainWeight(60) > 0, "even a bone is drawn");
  assert.ok(rainWeight(243) < rainWeight(1_000_000));
  assert.ok(rainWeight(1_000_000) < rainWeight(1_000_000_000));
  assert.equal(rainWeight(5_000_000_000), 1, "clamped at the top");
});

test("odometerCells keys digits from the right so a new digit shifts nothing", () => {
  const cells = odometerCells(276_692_118_004);
  assert.equal(cells.map((c) => c.char).join(""), "276,692,118,004");
  assert.equal(cells.filter((c) => c.kind === "sep").length, 3);

  const ones = (n: number) => odometerCells(n).find((c) => c.key === "d0")!.char;
  assert.equal(ones(999), "9");
  assert.equal(ones(1_000), "0");
  // Growing from 3 to 4 digits adds cells on the left; the existing keys hold.
  const before = odometerCells(999).map((c) => c.key);
  const after = odometerCells(1_000).map((c) => c.key);
  assert.deepEqual(after.slice(-before.length), before);

  assert.equal(odometerCells(0).map((c) => c.char).join(""), "0");
  assert.equal(odometerCells(-5).map((c) => c.char).join(""), "0", "never negative");
});

/* -------------------------------------------------------------------------- */
/* Leaderboards                                                               */
/* -------------------------------------------------------------------------- */

const ROWS: BoardRow[] = [
  { id: 1, name: "drabula", rank: 1, value: 1_400 },
  { id: 2, name: "Redquaker", rank: 2, value: 1_200 },
  { id: 3, name: "pizduley", rank: 3, value: 300 },
];

test("applyDelta adds a drop and keeps the order when nobody is passed", () => {
  const next = applyDelta(ROWS, 3, 50);
  assert.deepEqual(
    next.map((r) => [r.id, r.rank, r.value]),
    [
      [1, 1, 1_400],
      [2, 2, 1_200],
      [3, 3, 350],
    ],
  );
  assert.equal(ROWS[2]!.value, 300, "the input is not mutated");
});

test("applyDelta re-ranks on an overtake", () => {
  const next = applyDelta(ROWS, 2, 500);
  assert.deepEqual(
    next.map((r) => [r.id, r.rank]),
    [
      [2, 1],
      [1, 2],
      [3, 3],
    ],
  );
});

test("applyDelta returns the same array when there is nothing to do", () => {
  // Identity is how the island skips a re-render for the ~7 frames a second
  // that concern players who are not on the board.
  assert.equal(applyDelta(ROWS, 99, 500), ROWS);
  assert.equal(applyDelta(ROWS, 1, 0), ROWS);
  assert.equal(applyDelta(ROWS, 1, Number.NaN), ROWS);
});

test("toBoard carries ranked totals and survives a failed fetch", () => {
  const page: LeaderboardPage = {
    period: "20260917",
    scope: "groups",
    entries: [
      {
        rank: 1,
        id: 14,
        name: "Pegasus PvM",
        loot: { value: 11_505_056_095, value_formatted: "11.51B" },
        flair: { style: "amethyst", tier_key: "t3", tier_name: "Patron" },
      },
    ],
    meta: { page: 1, limit: 8, total: 307 },
  };
  const board = toBoard(page);
  assert.equal(board.ranked, 307);
  assert.equal(board.rows[0]!.flair, "amethyst");
  assert.equal(board.rows[0]!.flairTitle, "Patron");

  assert.deepEqual(toBoard(null), { rows: [], ranked: 0 });
});

/* -------------------------------------------------------------------------- */
/* Platform status                                                            */
/* -------------------------------------------------------------------------- */

const STATUS: StatusSummary = {
  categories: [],
  services: {
    generated_at: 1789657770,
    players_5m: 239,
    api: {
      status: "operational",
      online: true,
      players_1h: 523,
      processed: { "5m": 2138, "30m": 14871, "24h": 668366 },
      queue_depth: 0,
      consumer_alive: true,
    },
    webhook: {
      status: "operational",
      online: true,
      players_1h: 196,
      processed: { "5m": 472, "30m": 4263, "24h": 217561 },
    },
  },
};

test("toPlatformPulse sums both intake paths", () => {
  const pulse = toPlatformPulse(STATUS);
  assert.deepEqual(pulse, {
    state: "operational",
    processed24h: 885_927,
    processed30m: 19_134,
    processed5m: 2_610,
    // A headcount, de-duplicated by the backend: NOT 523 + 196, which would
    // count anyone seen on both intake paths twice.
    playersOnline: 239,
    openIssues: 0,
    generatedAt: 1789657770,
  });
});

test("toPlatformPulse leaves players online unknown for a backend that predates it", () => {
  const { players_5m: _omitted, ...services } = STATUS.services;
  const pulse = toPlatformPulse({ ...STATUS, services });
  // null, so the page shows no figure at all rather than a misleading 0.
  assert.equal(pulse?.playersOnline, null);
  assert.equal(pulse?.processed5m, 2_610);
});

test("toPlatformPulse grades the state by which path is down", () => {
  const webhookDown: StatusSummary = {
    ...STATUS,
    services: { ...STATUS.services, webhook: { ...STATUS.services.webhook, online: false } },
  };
  assert.equal(toPlatformPulse(webhookDown)?.state, "degraded");

  const apiDown: StatusSummary = {
    ...STATUS,
    services: { ...STATUS.services, api: { ...STATUS.services.api, online: false } },
  };
  assert.equal(toPlatformPulse(apiDown)?.state, "offline");
});

test("toPlatformPulse counts only unresolved issues", () => {
  const issue = (status: "open" | "monitoring" | "resolved") => ({
    id: 1,
    category_id: 1,
    title: "t",
    description: null,
    severity: "minor" as const,
    status,
    order: 0,
    created_by: null,
    created_at: null,
    updated_at: null,
    resolved_at: null,
  });
  const withIssues: StatusSummary = {
    ...STATUS,
    categories: [
      { id: 1, name: "Plugin", emoji: null, order: 0, issues: [issue("open"), issue("resolved"), issue("monitoring")] },
    ],
  };
  assert.equal(toPlatformPulse(withIssues)?.openIssues, 2);
});

test("toPlatformPulse shows nothing rather than the unreachable-backend zeroes", () => {
  assert.equal(toPlatformPulse(null), null);
  assert.equal(toPlatformPulse(EMPTY_STATUS_SUMMARY), null);
});

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

function event(over: Partial<EventSummary> & { id: number }): EventSummary {
  return EventSummarySchema.parse({
    group_id: 14,
    name: `Event ${over.id}`,
    status: "active",
    visibility: "public",
    starts_at: 100,
    ends_at: 1_000,
    ...over,
  });
}

test("liveEvents keeps only public events inside their window, soonest-ending first", () => {
  const events = [
    event({ id: 1, ends_at: 900 }),
    event({ id: 2, ends_at: 600 }),
    event({ id: 3, visibility: "private" }),
    event({ id: 4, status: "past" }),
    event({ id: 5, ends_at: 400 }), // still "active" until the sweep closes it
    event({ id: 6, starts_at: 800 }), // activated, not yet begun
    event({ id: 7, ends_at: null }),
  ];
  assert.deepEqual(
    liveEvents(events, 500, 10).map((e) => e.id),
    [2, 1, 7],
  );
  assert.equal(liveEvents(events, 500, 1).length, 1);
});

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

test("formatCount is locale-pinned, so SSR and hydration agree", () => {
  assert.equal(formatCount(26442), "26,442");
  assert.equal(formatCount(885926.6), "885,927");
});

test("formatAgo and formatCountdown read compactly", () => {
  assert.equal(formatAgo(1000, 1004), "now");
  assert.equal(formatAgo(1000, 1042), "42s");
  assert.equal(formatAgo(1000, 1000 + 12 * 60), "12m");
  assert.equal(formatAgo(1000, 1000 + 5 * 3600), "5h");
  assert.equal(formatAgo(1000, 1000 + 3 * 86_400), "3d");
  assert.equal(formatAgo(2000, 1000), "now", "clock skew never yields a negative age");

  assert.equal(formatCountdown(1000 + 2 * 86_400 + 4 * 3600, 1000), "2d 4h");
  assert.equal(formatCountdown(1000 + 3 * 3600 + 12 * 60, 1000), "3h 12m");
  assert.equal(formatCountdown(1000 + 20, 1000), "1m");
  assert.equal(formatCountdown(1000, 1000), null);
});

test("monthName is the UTC tracking month", () => {
  // 23:30 on Aug 31 in New York is already September in UTC — and the
  // leaderboards roll over on UTC.
  assert.equal(monthName(new Date("2026-09-01T03:30:00Z")), "September");
  assert.equal(monthName(new Date("2026-08-31T23:59:59Z")), "August");
});
