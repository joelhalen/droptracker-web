import assert from "node:assert/strict";
import { test } from "node:test";
import { perDropItemsFromEntries, taskConfigPerDropNames, withPerDrop } from "../lib/events";

// "Count each drop once": 3 Hueycoatl hides in one drop count as 1.
const task = {
  config: JSON.stringify({
    kind: "any_of",
    items: ["Hueycoatl hide", "Echo crystal", "Sunfire splinters"],
    per_drop_items: ["Hueycoatl hide", "Echo crystal"],
  }),
};

test("taskConfigPerDropNames reads the flagged names lower-cased", () => {
  assert.deepEqual([...taskConfigPerDropNames(task)].sort(), ["echo crystal", "hueycoatl hide"]);
  assert.equal(taskConfigPerDropNames({ config: null }).size, 0);
});

test("withPerDrop marks only the flagged entries", () => {
  const out = withPerDrop(
    [{ name: "Hueycoatl hide" }, { name: "Sunfire splinters" }],
    taskConfigPerDropNames(task),
  );
  assert.deepEqual(out, [{ name: "Hueycoatl hide", perDrop: true }, { name: "Sunfire splinters" }]);
});

test("perDropItemsFromEntries saves flagged non-pet names once", () => {
  assert.deepEqual(
    perDropItemsFromEntries([
      { name: "Hueycoatl hide", perDrop: true },
      { name: "hueycoatl hide", perDrop: true },
      { name: "Sunfire splinters" },
      { name: "Smol heredit", perDrop: true, isPet: true },
    ]),
    ["Hueycoatl hide"],
  );
});
