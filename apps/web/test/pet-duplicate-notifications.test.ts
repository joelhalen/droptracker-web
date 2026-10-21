import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EMBED_TYPES,
  EMBED_TYPE_LABELS,
  GroupConfigPatchSchema,
  formatPetList,
  getConfigField,
  parsePetList,
} from "@droptracker/api-types";
import { isFieldShown, seasonalKey, WIDE_TYPES } from "../lib/group-settings-sections";

/**
 * Duplicate pet notifications: which duplicates a group announces
 * (notify_pet_duplicates + notify_pet_duplicate_pets, backend
 * utils/pet_notifications.py) and the separate "pet_dupe" design.
 */

const mode = getConfigField("notify_pet_duplicates")!;
const list = getConfigField("notify_pet_duplicate_pets")!;

test("duplicates are announced by default, as they were before the setting", () => {
  assert.equal(mode.type, "select");
  assert.equal(mode.default, "all");
  assert.deepEqual(
    mode.options?.map((o) => o.value),
    ["all", "none", "selected"],
  );
  assert.equal(list.type, "petlist");
  assert.ok(WIDE_TYPES.has("petlist"));
  assert.ok(mode.seasonalMirror && list.seasonalMirror);
});

test("the pet list round-trips as a sorted JSON array, empty as blank", () => {
  assert.equal(formatPetList(["Vorki", "Olmlet", "Vorki", " "]), '["Olmlet","Vorki"]');
  assert.equal(formatPetList([]), "");
  assert.deepEqual(parsePetList('["Olmlet","Vorki"]'), ["Olmlet", "Vorki"]);
  assert.deepEqual(parsePetList(""), []);
  assert.equal(parsePetList("Olmlet"), null);
  assert.equal(parsePetList('{"a":1}'), null);
});

test("the PATCH schema accepts a pet list and refuses anything else", () => {
  assert.ok(GroupConfigPatchSchema.safeParse({ notify_pet_duplicate_pets: '["Olmlet"]' }).success);
  assert.ok(GroupConfigPatchSchema.safeParse({ notify_pet_duplicate_pets: "" }).success);
  assert.ok(!GroupConfigPatchSchema.safeParse({ notify_pet_duplicate_pets: "Olmlet" }).success);
  assert.ok(GroupConfigPatchSchema.safeParse({ notify_pet_duplicates: "selected" }).success);
  assert.ok(!GroupConfigPatchSchema.safeParse({ notify_pet_duplicates: "some" }).success);
});

test("the pet list only shows when duplicates are announced for chosen pets", () => {
  const key = (f: { key: string }) => f.key;
  assert.equal(isFieldShown(list, key, {}), false);
  assert.equal(isFieldShown(list, key, { notify_pet_duplicates: "none" }), false);
  assert.equal(isFieldShown(list, key, { notify_pet_duplicates: "selected" }), true);
  // Seasonal tab: follows the seasonal mirror, not the main-world value.
  const seasonal = (f: { key: string }) => seasonalKey(f.key);
  assert.equal(
    isFieldShown(list, seasonal, { notify_pet_duplicates: "selected", seasonal_notify_pet_duplicates: "all" }),
    false,
  );
  assert.equal(isFieldShown(list, seasonal, { seasonal_notify_pet_duplicates: "selected" }), true);
  assert.equal(isFieldShown(mode, key, {}), true);
});

test("duplicates have their own embed type", () => {
  assert.ok(EMBED_TYPES.includes("pet_dupe"));
  assert.equal(EMBED_TYPE_LABELS.pet_dupe, "Duplicate pets");
  // group_embeds.embed_type is VARCHAR(10).
  for (const t of EMBED_TYPES) assert.ok(t.length <= 10, t);
});
