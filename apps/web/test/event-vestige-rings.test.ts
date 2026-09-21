/**
 * "Gold rings count as vestiges" (config.vestige_rings). The DT2 bosses drop
 * a Gold ring, then two, on the rolls before a vestige, and by default a task
 * listing the vestige counts that ring as the vestige. A clan that scores Gold
 * rings in a task of their own switches it off on the vestige task. The task
 * form shows the switch only while a vestige is listed, stores only `false`,
 * and warns when another task in the event already scores Gold rings.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { isGoldRingName, isVestigeName, taskListsItem, vestigeRingsCount } from "@/lib/events";

const item = (target: string | null, config: Record<string, unknown> | null = null) => ({
  type: "item_collection" as const,
  target,
  config: config ? JSON.stringify(config) : null,
});

test("every DT2 vestige is recognised, whatever the case or spacing", () => {
  for (const name of ["Ultor vestige", "magus VESTIGE", " Venator  vestige ", "Bellator vestige"]) {
    assert.equal(isVestigeName(name), true, name);
  }
  assert.equal(isVestigeName("Gold ring"), false);
  assert.equal(isVestigeName("Ultor ring"), false);
});

test("the Gold ring itself is told apart from the vestiges", () => {
  assert.equal(isGoldRingName(" gold  RING"), true);
  assert.equal(isGoldRingName("Ultor vestige"), false);
  assert.equal(isGoldRingName("Gold ring (i)"), false);
});

test("rings count by default, including on every task saved before the switch", () => {
  assert.equal(vestigeRingsCount(item("Magus vestige")), true);
  assert.equal(vestigeRingsCount(item("Magus vestige", { source_npcs: ["Duke Sucellus"] })), true);
  assert.equal(vestigeRingsCount(item("Magus vestige", { vestige_rings: true })), true);
});

test("only an explicit false switches rings off", () => {
  assert.equal(vestigeRingsCount(item("Magus vestige", { vestige_rings: false })), false);
  assert.equal(vestigeRingsCount({ config: "not json" }), true);
});

test("a Gold ring task is found as a single target or anywhere in a list", () => {
  assert.equal(taskListsItem(item("Gold ring"), "Gold ring"), true);
  assert.equal(
    taskListsItem(item(null, { kind: "any_of", items: ["gold ring", "Bones"] }), "Gold ring"),
    true,
  );
  assert.equal(
    taskListsItem(
      item(null, {
        kind: "groups",
        groups: [{ mode: "any_of", need: 1, items: ["Gold ring"] }],
      }),
      "Gold ring",
    ),
    true,
  );
  assert.equal(taskListsItem(item("Magus vestige"), "Gold ring"), false);
});

test("only item-collection tasks can list an item", () => {
  assert.equal(
    taskListsItem({ type: "kc_target", target: "Gold ring", config: null }, "Gold ring"),
    false,
  );
});
