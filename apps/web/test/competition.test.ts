import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bonusRuleSentence,
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
