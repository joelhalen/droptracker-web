import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayerAchievementsSchema, PlayerDiariesSchema, PlayerOverviewSchema } from "@droptracker/api-types";
import {
  NO_CA_FILTERS,
  caTierIcon,
  compactNumber,
  filterCaTasks,
  flattenCaTasks,
  progressTone,
  rebaseImg,
} from "../lib/player-progress";

const combat = PlayerAchievementsSchema.parse({
  player_id: 1,
  has_synced: true,
  last_synced: null,
  account_type: null,
  combat_level: 100,
  combat_achievements: {
    tasks_completed: 2,
    total: 3,
    tiers: [],
    monsters: [
      {
        monster: "Zulrah",
        completed: 1,
        total: 2,
        tasks: [
          { name: "Snake Rebound", description: "Kill Zulrah.", tier: "Elite", type: "Mechanical", completed: false },
          { name: "Zulrah Novice", description: "Kill Zulrah once.", tier: "Easy", type: "Kill Count", completed: true },
        ],
      },
      {
        monster: "Barrows",
        completed: 1,
        total: 1,
        tasks: [{ name: "Barrows Novice", description: "Open the chest.", tier: "Easy", type: "Kill Count", completed: true }],
      },
    ],
  },
  quests: { not_started: 0, in_progress: 0, finished: 0 },
  diaries: [{ area_id: 0, name: "Karamja", tiers: [{ tier: 0, name: "Easy", completed: 3 }] }],
}).combat_achievements;

test("an achievements payload from before points and totals still parses", () => {
  assert.deepEqual(combat.thresholds, {});
  assert.equal(combat.points, undefined);
});

test("tasks flatten in the game's order: tier, then monster", () => {
  assert.deepEqual(
    flattenCaTasks(combat).map((t) => t.name),
    ["Barrows Novice", "Zulrah Novice", "Snake Rebound"],
  );
});

test("the four in-game filters and the search combine", () => {
  const tasks = flattenCaTasks(combat);
  assert.equal(filterCaTasks(tasks, NO_CA_FILTERS).length, 3);
  assert.deepEqual(
    filterCaTasks(tasks, { ...NO_CA_FILTERS, completed: "incomplete" }).map((t) => t.name),
    ["Snake Rebound"],
  );
  assert.equal(filterCaTasks(tasks, { ...NO_CA_FILTERS, tier: "Easy", monster: "Zulrah" }).length, 1);
  assert.equal(filterCaTasks(tasks, { ...NO_CA_FILTERS, type: "Kill Count", completed: "complete" }).length, 2);
  assert.equal(filterCaTasks(tasks, { ...NO_CA_FILTERS, query: "  chest " }).length, 1);
});

test("tier icons exist only for real tiers", () => {
  assert.equal(caTierIcon("Grandmaster"), "/osrs/ca-grandmaster.png");
  assert.equal(caTierIcon("Unknown"), null);
  assert.equal(caTierIcon(null), null);
});

test("progress tone follows the journal: red, yellow, green, grey when unknown", () => {
  assert.match(progressTone(0, 10), /red/);
  assert.match(progressTone(4, 10), /gold/);
  assert.match(progressTone(10, 10), /green/);
  assert.match(progressTone(null, 10), /parchment/);
  assert.match(progressTone(3, null), /parchment/);
});

test("site image URLs re-root for a same-origin host and others pass through", () => {
  assert.equal(rebaseImg("https://www.droptracker.io/img/npcdb/2.png", "/img"), "/img/npcdb/2.png");
  assert.equal(rebaseImg("https://example.com/a.png", "/img"), "https://example.com/a.png");
  assert.equal(rebaseImg(null, "/img"), null);
});

test("compact numbers", () => {
  assert.equal(compactNumber(950), "950");
  assert.equal(compactNumber(12_500), "12.5K");
  assert.equal(compactNumber(3_259_098), "3.26M");
});

test("a diary task with unknown state and an overview with no XP history parse", () => {
  const diaries = PlayerDiariesSchema.parse({
    player_id: 1,
    has_synced: true,
    last_synced: null,
    completed: 1,
    total: 2,
    areas: [
      {
        area_id: 0,
        name: "Karamja",
        completed: 1,
        total: 2,
        tiers: [
          {
            tier: 0,
            name: "Easy",
            completed: 1,
            total: 2,
            complete: false,
            tasks_known: false,
            task_source: null,
            tasks: [
              { description: "Pick bananas.", completed: null },
              { description: "Use the rope swing.", requirements: ["10 Agility"], completed: null },
            ],
          },
        ],
      },
    ],
  });
  assert.equal(diaries.areas[0]!.tiers[0]!.tasks[0]!.completed, null);
  assert.equal(diaries.wikisync_used, false);

  const zero = { loot: { value: 0, value_formatted: "0" }, drops: 0 };
  const overview = PlayerOverviewSchema.parse({
    player_id: 1,
    skills: {
      has_data: false,
      total_level: null,
      total_xp: null,
      combat_level: null,
      updated_at: null,
      gains: { day: null, week: null, month: null },
    },
    gains: { day: zero, week: zero, month: zero },
  });
  assert.deepEqual(overview.activity, []);
  assert.equal(overview.gains.week.clog, 0);
});
