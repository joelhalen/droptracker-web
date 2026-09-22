/**
 * The participant task list's difficulty filter. The board puts each task in
 * its tier's section, easiest first, with untiered tasks last. It only offers
 * the filter when there are at least two sections, because most bingo and
 * standard events leave some or all tasks untiered.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { EventTask } from "@droptracker/api-types";
import {
  TASK_DIFFICULTY_BUCKETS,
  TASK_DIFFICULTY_BUCKET_LABELS,
  groupTasksByDifficulty,
  taskDifficultyBucket,
} from "@/lib/events";

const task = (id: number, difficulty?: EventTask["difficulty"]) => ({ id, difficulty });

const shape = (tasks: ReturnType<typeof task>[]) =>
  groupTasksByDifficulty(tasks).map((s) => [s.difficulty, s.tasks.map((t) => t.id)]);

test("each tier is its own bucket; a null or absent difficulty is untiered", () => {
  assert.equal(taskDifficultyBucket(task(1, "air")), "air");
  assert.equal(taskDifficultyBucket(task(2, "fire")), "fire");
  assert.equal(taskDifficultyBucket(task(3, null)), "none");
  assert.equal(taskDifficultyBucket(task(4)), "none");
});

test("sections run easiest to hardest, then untiered, whatever the task order", () => {
  const tasks = [
    task(1, "fire"),
    task(2, null),
    task(3, "air"),
    task(4, "earth"),
    task(5, "water"),
  ];
  assert.deepEqual(shape(tasks), [
    ["air", [3]],
    ["water", [5]],
    ["earth", [4]],
    ["fire", [1]],
    ["none", [2]],
  ]);
});

test("tasks keep the event's own order inside a section", () => {
  const tasks = [task(9, "earth"), task(2, "air"), task(7, "earth"), task(4, "air"), task(8, "earth")];
  assert.deepEqual(shape(tasks), [
    ["air", [2, 4]],
    ["earth", [9, 7, 8]],
  ]);
});

test("a tier with no tasks gets no section", () => {
  assert.deepEqual(shape([task(1, "water"), task(2)]), [
    ["water", [1]],
    ["none", [2]],
  ]);
  assert.deepEqual(shape([]), []);
});

test("an untiered event is one section, so the board keeps its plain list", () => {
  const sections = groupTasksByDifficulty([task(1), task(2, null), task(3)]);
  assert.equal(sections.length, 1);
  assert.equal(sections[0]?.difficulty, "none");
});

test("every bucket has a player-facing label, and the tiers read as difficulties", () => {
  for (const bucket of TASK_DIFFICULTY_BUCKETS) {
    assert.ok(TASK_DIFFICULTY_BUCKET_LABELS[bucket], bucket);
  }
  assert.deepEqual(
    TASK_DIFFICULTY_BUCKETS.map((b) => TASK_DIFFICULTY_BUCKET_LABELS[b]),
    ["Easy", "Medium", "Hard", "Elite", "No difficulty"],
  );
});

test("sections keep the caller's own task objects", () => {
  const tasks = [
    { id: 1, difficulty: "air" as const, label: "Kill Vorkath" },
    { id: 2, difficulty: null, label: "Any pet" },
  ];
  const [easy] = groupTasksByDifficulty(tasks);
  assert.equal(easy?.tasks[0], tasks[0]);
});
