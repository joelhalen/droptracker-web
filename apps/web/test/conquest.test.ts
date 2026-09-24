/**
 * Conquest (web120a) display helpers and the designer's draft model: the
 * battle-log wording (no em-dashes, site copy), which tasks may drive a tile,
 * and the draft <-> PUT body round trip the map designer relies on.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ConquestBattle, ConquestMap, EventTask } from "@droptracker/api-types";
import { onlyKnownEventKinds } from "@droptracker/api-types";
import {
  battleText,
  diceText,
  draftFromMap,
  draftProblems,
  draftToInput,
  fmtPoints,
  holdingText,
  newKey,
  regionLabelPoint,
  ruleEligible,
  settingsSummary,
} from "@/lib/conquest";

const SETTINGS = {
  scoring_mode: "hold_time" as const,
  summary_hours: 24,
  battle_mode: "dice" as const,
  attack_dice: 2,
  defense_dice: 2,
  max_defense: 5,
  capture_defense: 1,
  start_mode: "neutral" as const,
  start_defense: 1,
  neutral_defense: 0,
};

function battle(over: Partial<ConquestBattle>): ConquestBattle {
  return {
    id: 1,
    tile_id: 7,
    team_id: 1,
    outcome: "claim",
    owner_before: null,
    owner_after: 1,
    defense_before: 0,
    defense_after: 1,
    attack_dice: [],
    defense_dice: [],
    player_id: null,
    player_name: null,
    source: "troop",
    at: 1_800_000_000,
    ...over,
  };
}

const NAMES = new Map([
  [1, "Red"],
  [2, "Blue"],
]);

test("battle text reads naturally for every outcome, without em-dashes", () => {
  const cases: [Partial<ConquestBattle>, string][] = [
    [{ outcome: "claim" }, "Red claimed Zulrah"],
    [{ outcome: "capture", owner_before: 2 }, "Red captured Zulrah from Blue"],
    [{ outcome: "breach", owner_before: 2 }, "Red broke through Zulrah's defenses"],
    [
      { outcome: "attack", owner_before: 2, defense_before: 3, defense_after: 2 },
      "Red attacked Zulrah (Blue): defense 3 to 2",
    ],
    [{ outcome: "repelled", owner_before: 2 }, "Blue held Zulrah against Red"],
    [{ outcome: "adjust", owner_after: 2 }, "An organiser set Zulrah to Blue"],
  ];
  for (const [over, want] of cases) {
    const text = battleText(battle(over), NAMES, "Zulrah");
    assert.equal(text, want);
    assert.ok(!text.includes("—"));
  }
});

test("dice text only for rows that rolled", () => {
  assert.equal(diceText(battle({ attack_dice: [6, 3], defense_dice: [5] })), "6 · 3 vs 5");
  assert.equal(diceText(battle({})), null);
});

test("which tasks can drive a tile", () => {
  const task = (type: string, config: string | null = null) =>
    ({ type, config }) as unknown as Pick<EventTask, "type" | "config">;
  assert.ok(ruleEligible(task("kc_target")));
  assert.ok(ruleEligible(task("item_collection", '{"kind":"any_of"}')));
  assert.ok(ruleEligible(task("item_collection")));
  assert.ok(!ruleEligible(task("item_collection", '{"kind":"all_of"}')));
  assert.ok(!ruleEligible(task("pb_target")));
  assert.ok(!ruleEligible(task("skill_target")));
});

test("points and holdings formatting", () => {
  assert.equal(fmtPoints(1234), "1,234");
  assert.equal(fmtPoints(12.34), "12.3");
  assert.equal(holdingText({ holding: 23 }, "hold_time"), "+23/h");
  assert.equal(holdingText({ holding: 8 }, "final"), "8 if it ended now");
  assert.match(settingsSummary(SETTINGS), /Points for every hour/);
  assert.ok(!settingsSummary({ ...SETTINGS, battle_mode: "attrition" }).includes("—"));
});

test("region label: stored anchor, else above the tiles", () => {
  assert.deepEqual(regionLabelPoint({ label_x: 0.2, label_y: 0.3 }, []), { x: 0.2, y: 0.3 });
  const at = regionLabelPoint({ label_x: null, label_y: null }, [
    { x: 0.4, y: 0.5 },
    { x: 0.6, y: 0.6 },
  ]);
  assert.equal(at.x, 0.5);
  assert.ok(at.y < 0.5);
});

function mapFixture(): ConquestMap {
  return {
    event_id: 9,
    status: "draft",
    settings: SETTINGS,
    preset: "gielinor",
    revision: 3,
    seeded: false,
    background_url: null,
    bg_width: null,
    bg_height: null,
    rules_hidden: false,
    regions: [
      {
        id: 4,
        name: "Morytania",
        color: "#6b5a7e",
        bonus: 3,
        sort: 0,
        label_x: null,
        label_y: null,
        owner_team_id: null,
        owner_since: null,
        tile_ids: [11],
      },
    ],
    tiles: [
      {
        id: 11,
        idx: 0,
        label: "Barrows",
        x: 0.8,
        y: 0.5,
        kind: "normal",
        value: 1,
        region_id: 4,
        icon_npc_id: 1673,
        icon_item_id: null,
        owner_team_id: null,
        defense: 0,
        owner_since: null,
        captures: 0,
        rules: [
          { id: 1, task_id: 101, label: "40 Barrows chests", type: "kc_target", troops: 1, target: 40, progress: {} },
        ],
        troops: {},
      },
    ],
    edges: [],
    teams: [],
    battles: [],
    window_start: null,
    window_end: null,
    now: null,
  };
}

test("draft round trip keeps regions, tiles and rules", () => {
  const draft = draftFromMap(mapFixture());
  assert.equal(draft.tiles[0]!.region_key, "r4");
  const body = draftToInput(draft, 3);
  assert.equal(body.revision, 3);
  assert.deepEqual(body.regions[0], {
    key: "r4",
    name: "Morytania",
    color: "#6b5a7e",
    bonus: 3,
    label_x: null,
    label_y: null,
  });
  assert.deepEqual(body.tiles[0]!.rules, [{ task_id: 101, troops: 1 }]);
  assert.equal(body.tiles[0]!.region_key, "r4");
});

test("respawn tiles never send rules", () => {
  const draft = draftFromMap(mapFixture());
  draft.tiles[0]!.kind = "respawn";
  assert.deepEqual(draftToInput(draft, 0).tiles[0]!.rules, []);
});

test("draft problems: ruleless tiles and a task driving two tiles", () => {
  const draft = draftFromMap(mapFixture());
  assert.deepEqual(draftProblems(draft), []);
  draft.tiles.push({ ...draft.tiles[0]!, key: "tnew1", label: "Copy" });
  assert.ok(draftProblems(draft).some((p) => p.includes("drives two tiles")));
  draft.tiles[1]!.rules = [];
  assert.ok(draftProblems(draft).some((p) => p.includes("nothing that earns troops")));
});

test("new keys never collide", () => {
  assert.equal(newKey("t", ["t1", "tnew1"]), "tnew2");
  assert.equal(newKey("r", []), "rnew1");
});

test("unknown event kinds are dropped before the strict enum parse", () => {
  const rows = [{ key: "bingo" }, { key: "some_future_kind" }, { key: "conquest" }];
  assert.deepEqual(onlyKnownEventKinds(rows), [{ key: "bingo" }, { key: "conquest" }]);
});
