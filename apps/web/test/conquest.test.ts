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
  autoConnect,
  battleText,
  diceText,
  draftFromMap,
  draftParts,
  isolatedTiles,
  teamReach,
  toggleEdge,
  draftProblems,
  draftToInput,
  fmtPoints,
  holdingText,
  newKey,
  presetAvailableTiles,
  presetSelectionBody,
  presetSelectionText,
  presetSuggestedHours,
  regionBonusText,
  regionLabelPoint,
  regionStanding,
  regionStatusText,
  ruleEligible,
  settingsSummary,
  tilesToControl,
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
  attack_range: "adjacent" as const,
  out_of_reach: "ignore",
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
          {
            id: 1,
            task_id: 101,
            label: "40 Barrows chests",
            type: "kc_target",
            troops: 1,
            once: false,
            target: 40,
            progress: {},
          },
        ],
        troops: {},
        held: {},
        max_defense: null,
        garrison: null,
        home_team_id: null,
        defense_cap: 5,
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
    shape: null,
  });
  assert.deepEqual(body.tiles[0]!.rules, [{ task_id: 101, troops: 1, once: false }]);
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

test("a drawn map's shapes survive a designer save untouched", () => {
  const map = mapFixture();
  map.tiles[0]!.shape = "M10 20l5 0 0 5-5 0z";
  map.regions[0]!.shape = "M0 0l30 0 0 30z";
  const body = draftToInput(draftFromMap(map), 3);
  assert.equal(body.tiles[0]!.shape, "M10 20l5 0 0 5-5 0z");
  assert.equal(body.regions[0]!.shape, "M0 0l30 0 0 30z");
});

const t = (id: number, owner: number | null, kind = "normal") => ({
  id,
  label: `T${id}`,
  kind,
  owner_team_id: owner,
});
const TEAM_NAMES = new Map([
  [1, "Red"],
  [2, "Blue"],
]);

test("region standing: leader, ties, control, respawns never count", () => {
  const lead = regionStanding([t(1, 1), t(2, 1), t(3, 2), t(4, null), t(5, null, "respawn")]);
  assert.equal(lead.total, 4);
  assert.equal(lead.leader, 1);
  assert.equal(lead.controller, null);
  assert.equal(lead.unowned, 1);
  assert.deepEqual(lead.counts, [
    { teamId: 1, tiles: 2 },
    { teamId: 2, tiles: 1 },
  ]);
  assert.equal(
    regionStatusText(lead, TEAM_NAMES),
    "Red leads with 2 of 4, 2 more to take control.",
  );

  const tie = regionStanding([t(1, 1), t(2, 2), t(3, null)]);
  assert.equal(tie.leader, null);
  assert.equal(regionStatusText(tie, TEAM_NAMES), "Contested: Red, Blue hold 1 of 3 each.");

  const held = regionStanding([t(1, 2), t(2, 2), t(9, null, "respawn")]);
  assert.equal(held.controller, 2);
  assert.equal(regionStatusText(held, TEAM_NAMES), "Blue controls it, all 2 tiles.");

  const empty = regionStanding([t(1, null), t(2, null)]);
  assert.equal(regionStatusText(empty, TEAM_NAMES), "Unclaimed. Hold all 2 tiles to take control.");
});

test("what a team still has to take", () => {
  const tiles = [t(1, 1), t(2, 2), t(3, null), t(4, null, "respawn")];
  assert.deepEqual(
    tilesToControl(tiles, 1).map((x) => x.id),
    [2, 3],
  );
});

test("region bonus wording follows the scoring mode, no em-dashes", () => {
  assert.equal(regionBonusText(3, "hold_time", 5), "Hold all 5 for +3 points an hour.");
  assert.equal(regionBonusText(1, "final", 2), "Hold all 2 at the end for +1 point.");
  for (const line of [
    regionBonusText(2, "final", 4),
    regionStatusText(regionStanding([]), TEAM_NAMES),
  ]) {
    assert.ok(!line.includes("\u2014"));
  }
});

const PRESET_REGIONS = [
  {
    key: "kourend",
    name: "Kourend & Kebos",
    color: "#b5743a",
    sea: false,
    tiles: [
      { key: "cox", label: "CoX", available: true },
      { key: "hydra", label: "Hydra", available: true },
      { key: "yama", label: "Yama", available: false },
    ],
  },
  {
    key: "seas",
    name: "The Seas",
    color: "#2f8fa3",
    sea: true,
    tiles: [
      { key: "paints", label: "Boat Paints", available: true },
      { key: "clams", label: "Ocean Encounters", available: true },
    ],
  },
];

test("the picker starts with every tile the server can build", () => {
  assert.deepEqual([...presetAvailableTiles(PRESET_REGIONS)], ["cox", "hydra", "paints", "clams"]);
});

test("a region with nothing picked is left off; the rest list what they leave out", () => {
  const body = presetSelectionBody(PRESET_REGIONS, new Set(["hydra"]));
  assert.deepEqual(body, { regions: ["kourend"], exclude_tiles: ["cox", "yama"] });
  assert.deepEqual(presetSelectionBody(PRESET_REGIONS, new Set()), {
    regions: [],
    exclude_tiles: [],
  });
});

test("the selection reads as tiles in regions", () => {
  assert.equal(
    presetSelectionText(PRESET_REGIONS, new Set(["hydra", "paints", "clams"])),
    "3 tiles in 2 regions",
  );
  assert.equal(presetSelectionText(PRESET_REGIONS, new Set(["cox"])), "1 tile in 1 region");
});

test("the troop cost follows the tile count", () => {
  const options = {
    presets: [],
    regions: PRESET_REGIONS,
    troop_hours_choices: [0.25, 0.5, 1],
    default_troop_hours: 0.5,
    suggested_troop_hours: 0.5,
    suggested_troop_hours_by_tiles: [0.5, 1, 1, 0.5, 0.25],
    default_unique_troops: 2,
  };
  assert.equal(presetSuggestedHours(options, 1), 1);
  assert.equal(presetSuggestedHours(options, 4), 0.25);
  assert.equal(presetSuggestedHours(options, 99), 0.25);
  assert.equal(presetSuggestedHours({ ...options, suggested_troop_hours_by_tiles: [] }, 3), 0.5);
});

/* ── Fronts and organiser overrides (web122a) ─────────────────────────── */

function threeTiles() {
  const map = mapFixture();
  const base = map.tiles[0]!;
  map.tiles = [0, 1, 2].map((i) => ({
    ...base,
    id: 11 + i,
    label: `T${i}`,
    x: 0.2 + i * 0.3,
    rules: [{ ...base.rules[0]!, id: i + 1, task_id: 101 + i }],
  }));
  return map;
}

test("connections round trip, drop with their tiles, and toggle", () => {
  const map = threeTiles();
  map.edges = [[11, 12]];
  let draft = draftFromMap(map);
  assert.deepEqual(draft.edges, [["t11", "t12"]]);
  draft = toggleEdge(draft, "t13", "t12");
  assert.deepEqual(draftToInput(draft, 0).edges, [
    ["t11", "t12"],
    ["t12", "t13"],
  ]);
  draft = toggleEdge(draft, "t12", "t11");
  assert.deepEqual(draft.edges, [["t12", "t13"]]);
  draft.tiles = draft.tiles.filter((x) => x.key !== "t13");
  assert.deepEqual(draftToInput(draft, 0).edges, []);
});

test("isolated tiles and separate parts", () => {
  const draft = draftFromMap(threeTiles());
  assert.equal(isolatedTiles(draft).length, 3);
  assert.equal(draftParts(draft), 3);
  const linked = toggleEdge(toggleEdge(draft, "t11", "t12"), "t12", "t13");
  assert.equal(isolatedTiles(linked).length, 0);
  assert.equal(draftParts(linked), 1);
});

test("connect nearby tiles leaves one connected map", () => {
  const map = threeTiles();
  map.tiles[2]!.x = 0.95; // far from the other two
  const draft = autoConnect(draftFromMap(map));
  assert.equal(draftParts(draft), 1);
  assert.equal(isolatedTiles(draft).length, 0);
});

test("tile overrides, homes and one-time rules reach the save body", () => {
  const draft = draftFromMap(mapFixture());
  draft.tiles[0] = {
    ...draft.tiles[0]!,
    max_defense: 3,
    garrison: 2,
    home_team_id: 7,
    rules: draft.tiles[0]!.rules.map((r) => ({ ...r, troops: 25, once: true })),
  };
  const tile = draftToInput(draft, 0).tiles[0]!;
  assert.equal(tile.max_defense, 3);
  assert.equal(tile.garrison, 2);
  assert.equal(tile.home_team_id, 7);
  assert.deepEqual(tile.rules, [{ task_id: 101, troops: 25, once: true }]);
  draft.tiles.push({ ...draft.tiles[0]!, key: "tnew1", rules: [] });
  assert.ok(draftProblems(draft).includes("A team can only have one home tile."));
});

test("a team's reach only applies with fronts on", () => {
  const map = { settings: SETTINGS, reach: { "1": [11, 12] } };
  assert.deepEqual(teamReach(map, 1), new Set([11, 12]));
  assert.equal(teamReach(map, null), null);
  assert.equal(teamReach({ ...map, settings: { ...SETTINGS, attack_range: "anywhere" } }, 1), null);
  assert.equal(teamReach({ settings: SETTINGS, reach: undefined }, 1), null);
  assert.match(settingsSummary(SETTINGS), /Attack only tiles next to your own/);
});
