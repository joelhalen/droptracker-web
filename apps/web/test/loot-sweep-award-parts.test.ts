import assert from "node:assert/strict";
import { test } from "node:test";
import { sweepAwardGroups, sweepAwardPart } from "../lib/events";

// The co-dev's "Wilderness Bosses" set: Dragon 2h under two bosses.
const task = {
  config: JSON.stringify({
    kind: "loot_sweep",
    groups: [
      {
        label: "Chaos Elemental",
        npcs: ["Chaos Elemental"],
        items: [{ item_name: "Dragon 2h sword", points: 2 }, { item_name: "Dragon pickaxe", points: 5 }],
      },
      {
        npcs: ["Venenatis", "Spindel"],
        items: [{ item_name: "Dragon 2h sword", points: 5 }],
      },
    ],
  }),
};

test("sweepAwardGroups lists each group's items in config order", () => {
  const groups = sweepAwardGroups(task);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]!.label, "Chaos Elemental");
  assert.equal(groups[1]!.label, "Venenatis"); // unlabeled: first NPC
  assert.deepEqual(groups[1]!.items, [{ item_name: "Dragon 2h sword", points: 5 }]);
});

test("sweepAwardPart resolves the same item to each group's boss", () => {
  assert.deepEqual(sweepAwardPart(task, "sweep:0:0"), {
    item_name: "Dragon 2h sword",
    npc: "Chaos Elemental",
  });
  assert.deepEqual(sweepAwardPart(task, "sweep:1:0"), {
    item_name: "Dragon 2h sword",
    npc: "Venenatis",
  });
});

test("sweepAwardPart rejects unknown choices", () => {
  assert.equal(sweepAwardPart(task, "sweep:2:0"), null);
  assert.equal(sweepAwardPart(task, "sweep:0:9"), null);
  assert.equal(sweepAwardPart(task, "item:Dragon 2h sword"), null);
});
