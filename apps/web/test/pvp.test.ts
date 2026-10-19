import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONFIG_CATEGORIES,
  EMBED_TYPES,
  GROUP_CONFIG_FIELDS,
  GroupPvpSchema,
  PlayerPvpSchema,
  PvpLeaderboardSchema,
  getConfigField,
} from "@droptracker/api-types";
import { SETTINGS_SECTIONS } from "../lib/group-settings-sections";

/**
 * PvP tracking (web136a). The payloads below are shaped exactly like the
 * backend's web_api/routes/pvp.py responses, so a drift on either side fails
 * here instead of as a Zod error on a live page.
 */

const money = (value: number, value_formatted: string) => ({ value, value_formatted });

const kill = {
  id: 9,
  player: { id: 1, name: "Killer" },
  victim: { name: "Zezima", id: null, combat_level: 103 },
  value: money(1_403_600, "1.40M"),
  item_count: 5,
  items: [
    { item_id: 4151, name: "Abyssal whip", quantity: 1, value: money(1_400_000, "1.40M"), icon_url: "https://www.droptracker.io/img/itemdb/4151.png" },
  ],
  world: 318,
  wilderness_level: 31,
  location: null,
  image_url: null,
  date: 1_792_411_200,
};

test("a PvP board page parses, with K/D null for a player with no kills or deaths", () => {
  const board = PvpLeaderboardSchema.parse({
    period: "202610",
    scope: "group:7",
    metric: "kills",
    entries: [
      { rank: 1, id: 1, name: "Killer", loot: money(5_000_000, "5.00M"), kills: 4, deaths: 1, kd: 4 },
      { rank: 2, id: 2, name: "Quiet", loot: money(0, "0"), kills: 0, deaths: 0, kd: null },
    ],
    meta: { page: 1, limit: 25, total: 2 },
  });
  assert.equal(board.entries[1]!.kd, null);
});

test("a group PvP page parses with and without a drawn board", () => {
  const base = {
    group: { id: 7, name: "Clan" },
    period: "202610",
    totals: { loot: money(1_403_600, "1.40M"), kills: 1, players: 1 },
    top_loot: [{ rank: 1, id: 1, name: "Killer", loot: money(1_403_600, "1.40M") }],
    top_kills: [{ rank: 1, id: 1, name: "Killer", kills: 1 }],
    recent: [kill],
  };
  assert.equal(GroupPvpSchema.parse({ ...base, board: null }).board, null);
  const drawn = GroupPvpSchema.parse({
    ...base,
    board: { url: "https://www.droptracker.io/img/clans/7/lb/pvp_lootboard.png?v=1", updated_at: 1 },
  });
  assert.match(drawn.board!.url, /pvp_lootboard\.png/);
});

test("a player's PvP record parses, including a death with no known value", () => {
  const line = { loot: money(0, "0"), kills: 0, deaths: 1, kd: null, rank: null };
  const pvp = PlayerPvpSchema.parse({
    player: { id: 1, name: "Killer" },
    period: "202610",
    stats: line,
    all_time: { ...line, kills: 3, kd: 3, rank: 12 },
    recent_kills: [kill],
    recent_deaths: [{ id: 5, killer: "Zezima", location: "Lava Maze", value_lost: null, date: null }],
  });
  assert.equal(pvp.recent_deaths[0]!.value_lost, null);
});

test("PvP settings have their own section, and the channel never falls back", () => {
  assert.ok(CONFIG_CATEGORIES.some((c) => c.id === "pvp"));
  assert.ok(SETTINGS_SECTIONS.some((s) => s.id === "pvp"));
  const keys = GROUP_CONFIG_FIELDS.filter((f) => f.category === "pvp").map((f) => f.key);
  for (const key of [
    "channel_id_to_post_pvp",
    "pvp_minimum_value_to_notify",
    "pvp_same_victim_daily_limit",
    "pvp_lootboard_channel_id",
  ]) {
    assert.ok(keys.includes(key), key);
  }
  assert.match(getConfigField("channel_id_to_post_pvp")!.help, /never uses the drops channel/);
  for (const f of GROUP_CONFIG_FIELDS.filter((f) => f.category === "pvp")) {
    assert.ok(!`${f.label} ${f.help}`.includes("—"), `${f.key} has an em-dash`);
  }
});

test("both PvP messages can be customised in the embed builder", () => {
  assert.ok(EMBED_TYPES.includes("pvp_kill"));
  assert.ok(EMBED_TYPES.includes("pvp_death"));
});
