/**
 * The before → after receipt shown after a manual award or confirm: the
 * organizer reads it to check the credit landed, so every number the backend
 * could read must show, a number it couldn't must be left out (not shown as
 * 0), and a credit that moved nothing must be flagged.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  completedNow,
  nothingMoved,
  receiptLines,
  ScoreChangeFieldSchema,
  type EventScoreChange,
  type ReceiptLine,
} from "@/lib/event-credit-receipt";

const at = (lines: ReceiptLine[], i: number): ReceiptLine => {
  const l = lines[i];
  assert.ok(l, `line ${i}`);
  return l;
};

const change = (over: Partial<EventScoreChange> = {}): EventScoreChange => ({
  team: { id: 3, name: "Blue", unit: "points", score: { before: 100, after: 110, delta: 10 } },
  task: {
    id: 5,
    label: "Kill Zulrah 50 times",
    progress: { before: 45, after: 50, delta: 5 },
    threshold: 50,
    completed_before: false,
    completed_after: true,
  },
  player: { id: 9, name: "Zezima", unit: "points", value: { before: 0, after: 5, delta: 5 } },
  ...over,
});

test("team, player and task progress each read before → after", () => {
  const lines = receiptLines(change());
  const [team, player, task] = [at(lines, 0), at(lines, 1), at(lines, 2)];
  assert.deepEqual(
    { label: team.label, before: team.before, after: team.after, delta: team.delta },
    { label: "Blue", before: "100", after: "110 pts", delta: "+10 pts" },
  );
  assert.equal(player.label, "Zezima");
  assert.equal(player.delta, "+5 pts");
  assert.equal(task.before, "45 / 50");
  assert.equal(task.after, "50 / 50");
  assert.equal(task.delta, "+5");
});

test("race units and decimals", () => {
  const lines = receiptLines(
    change({
      team: { id: 1, name: "Red", unit: "kills", score: { before: 1000, after: 1012.5, delta: 12.5 } },
      player: { id: 2, name: "Lynx", unit: "xp", value: { before: 1500, after: 250000, delta: 248500 } },
    }),
  );
  assert.equal(at(lines, 0).after, "1,012.5 kills");
  assert.equal(at(lines, 1).delta, "+248,500 XP");
});

test("an unreadable number is left out, not shown as zero", () => {
  const lines = receiptLines(change({ player: null, team: { id: 3, name: null, unit: "points", score: null } }));
  assert.deepEqual(
    lines.map((l) => l.key),
    ["task"],
  );
});

test("completion and the nothing-moved warning", () => {
  assert.equal(completedNow(change()), true);
  assert.equal(nothingMoved(change()), false);
  const flat = change({
    team: { id: 3, name: "Blue", unit: "points", score: { before: 100, after: 100, delta: 0 } },
    player: null,
    task: {
      id: 5,
      label: null,
      progress: { before: 50, after: 50, delta: 0 },
      threshold: 50,
      completed_before: true,
      completed_after: true,
    },
  });
  assert.equal(nothingMoved(flat), true);
  assert.equal(completedNow(flat), false);
  assert.equal(at(receiptLines(flat), 0).delta, "±0 pts");
});

test("a negative change reads as a minus", () => {
  const lines = receiptLines(
    change({ team: { id: 3, name: "Blue", unit: "points", score: { before: 10, after: 7, delta: -3 } } }),
  );
  assert.equal(at(lines, 0).delta, "−3 pts");
});

test("the response field parses, and a malformed receipt becomes null", () => {
  assert.deepEqual(ScoreChangeFieldSchema.parse(change()), change());
  assert.equal(ScoreChangeFieldSchema.parse(undefined), undefined);
  assert.equal(ScoreChangeFieldSchema.parse(null), null);
  assert.equal(ScoreChangeFieldSchema.parse({ team: "nope" }), null);
});
