import assert from "node:assert/strict";
import { test } from "node:test";
import { PointsLeaderboardSchema, PointsBehaviorSchema } from "@droptracker/api-types";
import {
  isCombinedRow,
  leaderboardHref,
  matchRange,
  MAX_LEADERBOARD_QUERY,
  normalizeQuery,
  otherAccounts,
  primaryShare,
} from "@/lib/points-leaderboard";

/**
 * The points leaderboard's search runs on the backend — a hit keeps the rank it
 * holds on the FULL board — so the page's whole job is carrying `q` through
 * every link without losing the period, and showing which accounts stand
 * behind a combined row. Both are pure, so both are pinned here.
 */

const BASE = "/groups/iron-legion";

// --- leaderboardHref ---------------------------------------------------------

test("the default board has a clean URL", () => {
  assert.equal(leaderboardHref(BASE), `${BASE}/points/leaderboard`);
  assert.equal(leaderboardHref(BASE, { period: "month", page: 1 }), `${BASE}/points/leaderboard`);
});

test("period, search and page are all carried", () => {
  assert.equal(
    leaderboardHref(BASE, { period: "season:12", q: "iron bob", page: 3 }),
    `${BASE}/points/leaderboard?period=season%3A12&q=iron+bob&page=3`,
  );
});

test("a search term is trimmed and capped the way the backend reads it", () => {
  assert.equal(leaderboardHref(BASE, { q: "   " }), `${BASE}/points/leaderboard`);
  assert.equal(normalizeQuery("  iron   bob "), "iron bob");
  assert.equal(normalizeQuery("x".repeat(200)).length, MAX_LEADERBOARD_QUERY);
  assert.equal(normalizeQuery(undefined), "");
});

test("a search term cannot smuggle extra parameters into the URL", () => {
  const href = leaderboardHref(BASE, { q: "a&page=9#x" });
  assert.equal(new URL(href, "https://x.test").searchParams.get("q"), "a&page=9#x");
  assert.equal(new URL(href, "https://x.test").searchParams.get("page"), null);
});

// --- combined rows -----------------------------------------------------------

const entry = (accounts: { id: number; name: string; points: number }[]) => ({
  rank: 1,
  id: accounts[0]!.id,
  name: accounts[0]!.name,
  points: accounts.reduce((sum, a) => sum + a.points, 0),
  accounts,
});

test("a per-RSN row has no other accounts", () => {
  const row = entry([{ id: 1, name: "Main", points: 50 }]);
  assert.equal(isCombinedRow(row), false);
  assert.deepEqual(otherAccounts(row), []);
});

test("a combined row lists the accounts other than the one it is shown under", () => {
  const row = entry([
    { id: 2, name: "Alt", points: 80 },
    { id: 1, name: "Main", points: 50 },
  ]);
  assert.equal(isCombinedRow(row), true);
  assert.deepEqual(
    otherAccounts(row).map((a) => a.name),
    ["Main"],
  );
});

test("the headline account's share, not the combined total", () => {
  const row = entry([
    { id: 2, name: "Alt", points: 80 },
    { id: 1, name: "Main", points: 50 },
  ]);
  assert.equal(row.points, 130);
  assert.equal(primaryShare(row), 80);
});

test("with no breakdown (older backend) the share is the row's total", () => {
  assert.equal(primaryShare({ rank: 1, id: 1, name: "Main", points: 50, accounts: [] }), 50);
});

// --- matchRange --------------------------------------------------------------

test("highlights the matched part, ignoring case", () => {
  assert.deepEqual(matchRange("Iron Bob", "bob"), [5, 8]);
  assert.deepEqual(matchRange("Iron Bob", "IRON"), [0, 4]);
});

test("treats '-', '_' and ' ' as one character, like the backend", () => {
  assert.deepEqual(matchRange("Tzuk Kal Lag", "tzuk-kal"), [0, 8]);
  assert.deepEqual(matchRange("a_b", "a b"), [0, 3]);
});

test("no highlight when this name is not the one that matched", () => {
  assert.equal(matchRange("Main", "alt"), null);
  assert.equal(matchRange("Main", ""), null);
});

// --- contract ----------------------------------------------------------------

test("a pre-upgrade backend payload still parses, as a per-RSN board", () => {
  // The web deploy and the webapi restart are separate steps; whichever lands
  // first must not take the page down.
  const parsed = PointsLeaderboardSchema.parse({
    period: "202609",
    group_id: 7,
    group_name: "Iron Legion",
    entries: [{ rank: 1, id: 1, name: "Main", points: 50 }],
    seasons: [],
    meta: { page: 1, limit: 50, total: 1 },
  });
  assert.equal(parsed.combined, false);
  assert.equal(parsed.query, "");
  assert.deepEqual(parsed.entries[0]!.accounts, []);
  assert.equal(isCombinedRow(parsed.entries[0]!), false);
});

test("behavior without the new toggle parses as off", () => {
  const parsed = PointsBehaviorSchema.parse({
    stacks_award_points: false,
    point_sharing: false,
    point_sharing_method: "equal_split",
    points_require_group_only: false,
    points_leaderboard_public: true,
    min_submission_pts: 0,
    max_submission_pts: 0,
  });
  assert.equal(parsed.points_combine_accounts, false);
  assert.equal(parsed.points_ephemeral_messages, false);
});
