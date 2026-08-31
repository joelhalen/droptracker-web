import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bonusRuleIcon,
  bonusRuleSentence,
  bonusRuleToInput,
  competitionBlockToInput,
  COMPETITION_SKILLS,
  formatGained,
  formatTimeMs,
  isCompetitionKind,
  metricSummary,
  parseTimeToMs,
  rateSentence,
  scoreText,
} from "../lib/competition";
import { EventCompetitionInputSchema } from "@droptracker/api-types";
import { mockEventCompetitionBlock } from "../lib/mock-data";

test("isCompetitionKind matches exactly the two kinds", () => {
  assert.equal(isCompetitionKind("sotw"), true);
  assert.equal(isCompetitionKind("botw"), true);
  assert.equal(isCompetitionKind("loot_sweep"), false);
  assert.equal(isCompetitionKind("standard"), false);
  assert.equal(isCompetitionKind(null), false);
});

test("skill picker entries carry lowercase keys and no Overall", () => {
  assert.equal(COMPETITION_SKILLS.some((s) => s.key === "mining"), true);
  assert.equal(COMPETITION_SKILLS.some((s) => s.key === "overall"), false);
  for (const s of COMPETITION_SKILLS) assert.equal(s.key, s.display.toLowerCase());
});

test("formatGained mirrors the backend abbreviation", () => {
  assert.equal(formatGained(2_481_034, "skill"), "2.48M XP");
  assert.equal(formatGained(312, "boss"), "312 KC");
  assert.equal(formatGained(1_500_000_000, "skill"), "1.5B XP");
  assert.equal(formatGained(150_000, "skill"), "150K XP");
  assert.equal(formatGained(0, "boss"), "0 KC");
});

test("scoreText words the ranked number per mode", () => {
  assert.equal(scoreText(213, "points", "boss"), "213 pts");
  assert.equal(scoreText(312, "gained", "boss"), "312 KC");
  assert.equal(scoreText(2_481_034, "gained", "skill"), "2.48M XP");
});

test("formatTimeMs / parseTimeToMs round-trip tick precision", () => {
  assert.equal(formatTimeMs(91_800), "1:31.8");
  assert.equal(formatTimeMs(52_000), "0:52");
  assert.equal(parseTimeToMs("1:31.8"), 91_800);
  assert.equal(parseTimeToMs("0:52"), 52_000);
  assert.equal(parseTimeToMs("52"), 52_000);
  assert.equal(parseTimeToMs("91.8"), 91_800);
  assert.equal(parseTimeToMs("nonsense"), null);
  assert.equal(parseTimeToMs(""), null);
});

test("bonusRuleSentence words rules exactly like the Discord award line", () => {
  assert.equal(
    bonusRuleSentence({ type: "pet", points: 100, max_awards: 1, pets: ["Pet snakeling"] }),
    "+100 pts for a new Pet snakeling",
  );
  assert.equal(
    bonusRuleSentence({
      type: "time_under",
      points: 5,
      max_awards: 3,
      npc: "Zulrah",
      threshold_ms: 60_000,
    }),
    "+5 pts for a Zulrah kill under 1:00, up to 3× per player",
  );
});

test("metricSummary + rateSentence", () => {
  const block = mockEventCompetitionBlock();
  assert.equal(metricSummary(block), "Zulrah — most kills gained wins");
  assert.equal(rateSentence(10_000, "skill"), "Every 10,000 XP = 1 pt");
  assert.equal(rateSentence(undefined, "boss"), "Every 1 kill = 1 pt");
});

test("competitionBlockToInput round-trips the mock block", () => {
  const input = competitionBlockToInput(mockEventCompetitionBlock());
  assert.deepEqual(input.npcs, ["Zulrah"]);
  assert.equal(input.ranking?.mode, "gained");
  assert.equal(input.participation, "signup");
  assert.equal(input.bonus_rules?.length, 2);
  assert.equal(input.bonus_rules?.[0]?.type, "pet");
  assert.deepEqual(input.bonus_rules?.[0]?.pets, ["Pet snakeling"]);
  assert.equal(input.bonus_rules?.[1]?.threshold_ms, 60_000);
  // Absent block → sane defaults.
  const fresh = competitionBlockToInput(null);
  assert.equal(fresh.participation, "whole_clan");
  assert.equal(fresh.ranking?.mode, "gained");
});


test("bonusRuleSentence words a task rule from its derived shape", () => {
  assert.equal(
    bonusRuleSentence({
      type: "task",
      points: 25,
      task_kind: "item_collection",
      progress_kind: "distinct",
      need: 3,
      scope_line: "at Zulrah",
    }),
    "+25 pts for all 3 listed drops (at Zulrah)",
  );
  assert.equal(
    bonusRuleSentence({
      type: "task",
      points: 10,
      max_awards: 3,
      task_kind: "item_collection",
      progress_kind: "points",
      need: 500,
      scope_line: "at Vorkath",
    }),
    "+10 pts for 500 pts of listed loot (at Vorkath), up to 3× per player",
  );
});

test("an admin label replaces the derived goal, never the points", () => {
  assert.equal(
    bonusRuleSentence({
      type: "task",
      points: 40,
      label: "the full Zulrah set",
      task_kind: "item_collection",
      progress_kind: "distinct",
      need: 3,
    }),
    "+40 pts for the full Zulrah set",
  );
});

test("bonusRuleSentence words a milestone", () => {
  assert.equal(
    bonusRuleSentence({ type: "milestone", points: 10, step: 100, max_awards: 20 }),
    "+10 pts for every 100 gained, up to 20× per player",
  );
});

test("an unknown rule type still says what it is worth", () => {
  // A backend that ships a new rule type first must degrade, not throw.
  const sentence = bonusRuleSentence({
    type: "some_future_type" as never,
    points: 15,
    label: "Something new",
  });
  assert.equal(sentence, "+15 pts for Something new");
  assert.equal(bonusRuleIcon("some_future_type"), "✨");
  assert.equal(bonusRuleIcon("task"), "🎯");
});

test("bonusRuleToInput keeps the criteria and drops the display projection", () => {
  const input = bonusRuleToInput({
    id: 3,
    type: "task",
    points: 25,
    max_awards: 1,
    label: "Zulrah set",
    scope_line: "at Zulrah",
    task_kind: "item_collection",
    progress_kind: "distinct",
    need: 3,
    npcs: ["Zulrah"],
    items_preview: ["Tanzanite fang"],
    item_count: 3,
    task: {
      type: "item_collection",
      target: null,
      target_value: 3,
      config: '{"kind":"all_of"}',
    },
  });
  // The embedded criteria are the whole point: losing them on a manager
  // round-trip would silently erase the rule.
  assert.deepEqual(input.task, {
    type: "item_collection",
    target: null,
    target_value: 3,
    config: '{"kind":"all_of"}',
  });
  assert.equal(input.points, 25);
  for (const dropped of ["id", "scope_line", "task_kind", "progress_kind", "need", "npcs", "items_preview", "item_count", "label"]) {
    assert.equal(dropped in input, false, `${dropped} should not round-trip`);
  }
});

test("an admin's own label round-trips; a derived one does not", () => {
  // `label` is the sentence to SHOW — derived when the admin named nothing.
  // Echoing it back would freeze that derived text into the stored config.
  const base = {
    id: 3,
    type: "task" as const,
    points: 25,
    max_awards: 1,
    need: 3,
    task: { type: "item_collection" as const, target: null, target_value: 3, config: null },
  };
  assert.equal(bonusRuleToInput({ ...base, label: "Collect all 3 listed drops" }).label, undefined);
  const named = bonusRuleToInput({
    ...base,
    label: "The full Zulrah set",
    custom_label: "The full Zulrah set",
  });
  assert.equal(named.label, "The full Zulrah set");
  assert.equal("custom_label" in named, false);
});

test("a blanked target round-trips as null without failing the input schema", () => {
  // Every embedded type but pb_target / skill_target / a single item blanks
  // its target, and the backend serializes that as JSON null.
  const input = competitionBlockToInput({
    ...mockEventCompetitionBlock(),
    bonus_rules: [
      {
        id: 1,
        type: "task" as const,
        points: 25,
        max_awards: 1,
        label: "Set",
        task: {
          type: "item_collection" as const,
          target: null,
          target_value: 3,
          config: '{"kind":"all_of"}',
        },
      },
    ],
  });
  const parsed = EventCompetitionInputSchema.safeParse(input);
  assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
});

test("competitionBlockToInput round-trips a task rule intact", () => {
  const block = {
    ...mockEventCompetitionBlock(),
    bonus_rules: [
      {
        id: 1,
        type: "task" as const,
        points: 25,
        max_awards: 1,
        label: "Set",
        need: 3,
        task: {
          type: "item_collection" as const,
          target: null,
          target_value: 3,
          config: '{"kind":"all_of"}',
        },
      },
    ],
  };
  const input = competitionBlockToInput(block);
  assert.equal(input.bonus_rules?.[0]?.task?.config, '{"kind":"all_of"}');
});
