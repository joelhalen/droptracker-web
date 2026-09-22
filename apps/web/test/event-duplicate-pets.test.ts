/**
 * "Duplicate pets count" (config.duplicate_pets). The pet processor sends every
 * pet to the event engine, duplicates included, and each task decides whether
 * a duplicate of a pet the player already owns counts. An absent key keeps the
 * behaviour each task type had before the switch: item lists count them, pet
 * tasks and loot sweeps don't. The task form stores only a value unlike that
 * default.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { duplicatePetsCount, duplicatePetsDefault } from "@/lib/events";
import type { EventTask } from "@droptracker/api-types";

const task = (type: EventTask["type"], config: Record<string, unknown> | null = null) => ({
  type,
  config: config ? JSON.stringify(config) : null,
});

test("each task type keeps its old behaviour when the config doesn't say", () => {
  assert.equal(duplicatePetsDefault("item_collection"), true);
  assert.equal(duplicatePetsDefault("pet_collection"), false);
  assert.equal(duplicatePetsDefault("loot_sweep"), false);
  assert.equal(duplicatePetsCount(task("pet_collection")), false);
  assert.equal(duplicatePetsCount(task("pet_collection", { pets: ["Vorki"] })), false);
  assert.equal(
    duplicatePetsCount(task("item_collection", { kind: "any_of", pet_items: ["Vorki"] })),
    true,
  );
  assert.equal(duplicatePetsCount(task("loot_sweep", { kind: "loot_sweep" })), false);
});

test("an explicit boolean overrides the default either way", () => {
  assert.equal(duplicatePetsCount(task("pet_collection", { duplicate_pets: true })), true);
  assert.equal(duplicatePetsCount(task("loot_sweep", { duplicate_pets: true })), true);
  assert.equal(duplicatePetsCount(task("item_collection", { duplicate_pets: false })), false);
});

test("anything that isn't a boolean reads as the default", () => {
  assert.equal(duplicatePetsCount(task("pet_collection", { duplicate_pets: "true" })), false);
  assert.equal(duplicatePetsCount(task("item_collection", { duplicate_pets: 0 })), true);
  assert.equal(duplicatePetsCount({ type: "pet_collection", config: "not json" }), false);
});
