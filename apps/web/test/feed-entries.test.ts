import assert from "node:assert/strict";
import { test } from "node:test";
import { toFeedEntry } from "../lib/feed-entries";
import { toActivityFeedRow } from "../lib/activity/feed";

// One frame, one meaning: the Activity's feed rows are a projection of the
// site ticker's parse, so the two can no longer gate the same frame apart.

test("a PB without a board rank is dropped on both surfaces", () => {
  const data = { player_id: 5, player_name: "Zezima", npc_name: "Vorkath", time_display: "1:02" };
  assert.equal(toFeedEntry("personal_best", data, "k"), null);
  assert.equal(toActivityFeedRow("personal_best", data, "k"), null);
  const ranked = { ...data, rank: 3, team_size: "Solo" };
  assert.equal(toActivityFeedRow("personal_best", ranked, "k")?.detail, "#3 personal best · Solo");
});

test("a drop with no item name still shows (the ticker shows it)", () => {
  const row = toActivityFeedRow("drop", { player_id: 5, player_name: "Zezima", value: 12_000_000 }, "k");
  assert.equal(row?.headline, "a valuable drop");
  assert.equal(row?.value, 12_000_000);
  assert.equal(toActivityFeedRow("drop", { player_name: "Z", value: 0 }, "k"), null);
});

test("new clans and supporters reach the Activity", () => {
  const clan = toActivityFeedRow("group_created", { group_id: 42, group_name: "Iron Foundry" }, "k");
  assert.equal(clan?.groupId, 42);
  assert.equal(clan?.playerId, null);
  assert.equal(clan?.subject, "Iron Foundry");
  const sub = toActivityFeedRow("subscription", { kind: "user", name: "Zezima", player_id: 9 }, "k");
  assert.equal(sub?.playerId, 9);
  assert.equal(sub?.groupId, null);
});

test("live icons are mapped to iframe-safe addresses", () => {
  const row = toActivityFeedRow(
    "drop",
    { player_name: "Z", value: 50_000_000, item_name: "Twisted bow", icon_url: "https://www.droptracker.io/img/itemdb/20997.png" },
    "k",
  );
  assert.equal(row?.iconUrl, "/img/itemdb/20997.png");
});

test("unknown frame types are ignored", () => {
  assert.equal(toActivityFeedRow("announcement", { title: "x" }, "k"), null);
});
