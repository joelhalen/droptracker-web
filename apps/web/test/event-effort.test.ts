/**
 * EHE (Efficient Hours towards Event) captioning. The numbers come from the server; these helpers only
 * decide how they read — and the readings that matter are the honest ones:
 * a sub-hour grind must not round away to nothing, and an unpriceable boss
 * must not read as "did nothing".
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { EventEffort, EventEffortBoss } from "@droptracker/api-types";
import {
  effortKillLabel,
  effortPairNote,
  effortSummary,
  formatEheHours,
  isClueEffort,
} from "@/lib/events";
import { eheRatesKnown } from "@/components/event-ehe";

function effort(over: Partial<EventEffort> = {}): EventEffort {
  return {
    ehb_hours: 0,
    ehb_estimated_hours: 0,
    kills: 0,
    bosses: [],
    boss_count: 0,
    last_at: null,
    frozen: 0,
    rates_known: true,
    ...over,
  };
}

test("formatEheHours keeps sub-hour effort visible as minutes", () => {
  // 0.4h at a boss is a real session; "0h" would say the opposite.
  assert.equal(formatEheHours(0.4), "24m");
  assert.equal(formatEheHours(0.99), "59m");
  // Anything non-zero rounds to at least a minute rather than to "0m".
  assert.equal(formatEheHours(0.001), "1m");
});

test("formatEheHours drops precision as the number grows", () => {
  assert.equal(formatEheHours(1), "1.0h");
  assert.equal(formatEheHours(7.06), "7.1h");
  assert.equal(formatEheHours(12.4), "12h");
  assert.equal(formatEheHours(1234.5), "1,235h");
});

test("formatEheHours renders nothing-to-price as an em dash, not a zero", () => {
  // 0 EHB means "no rate we can price this with" as often as it means "idle" —
  // the kill count is shown separately and tells the real story.
  assert.equal(formatEheHours(0), "—");
  assert.equal(formatEheHours(null), "—");
  assert.equal(formatEheHours(undefined), "—");
  assert.equal(formatEheHours(Number.NaN), "—");
  assert.equal(formatEheHours(-3), "—");
});

test("formatEheHours marks derived-rate estimates with a tilde", () => {
  // Hours priced with DropTracker-derived rates (bosses WOM doesn't price)
  // must never pose as the standard number — thread #93's labelling promise.
  assert.equal(formatEheHours(12.4, true), "~12h");
  assert.equal(formatEheHours(1, true), "~1.0h");
  assert.equal(formatEheHours(0.4, true), "~24m");
  // Nothing to price stays an em dash — a tilde on a dash would be noise.
  assert.equal(formatEheHours(0, true), "—");
  // Explicit false is the plain label.
  assert.equal(formatEheHours(12.4, false), "12h");
});

test("effortSummary glosses the EHB figure in plain kills", () => {
  assert.equal(effortSummary(effort({ kills: 1, boss_count: 1 })), "1 kill");
  assert.equal(effortSummary(effort({ kills: 240, boss_count: 1 })), "240 kills");
  assert.equal(
    effortSummary(effort({ kills: 520, boss_count: 2 })),
    "520 kills at 2 bosses",
  );
});

test("effortSummary says so when there is nothing yet", () => {
  assert.equal(effortSummary(effort()), "No tracked kills yet");
  assert.equal(effortSummary(null), "No tracked kills yet");
  assert.equal(effortSummary(undefined), "No tracked kills yet");
});

test("effortSummary falls back to the boss list when boss_count is absent", () => {
  const e = effort({ kills: 30, bosses: [{} as never, {} as never] });
  delete (e as Partial<EventEffort>).boss_count;
  assert.equal(effortSummary(e), "30 kills at 2 bosses");
});

/**
 * `eheRatesKnown` decides whether an EHE figure is a measurement at all.
 *
 * When the backend's rate table is cold, every boss with a published rate
 * prices at 0 and the total collapses — which looks exactly like a player who
 * did nothing. On 2026-08-28 that state ran site-wide for a day and every
 * surface rendered a confident dash, because only the admin report carried the
 * flag. The default must stay permissive so an older payload (or a scalar-only
 * one) renders as it always did.
 */
test("eheRatesKnown only reports unavailable on an explicit false", () => {
  assert.equal(eheRatesKnown(false), false);
  assert.equal(eheRatesKnown(true), true);
  // Absent flag = older API or a payload with no per-player effort object.
  assert.equal(eheRatesKnown(undefined), true);
  assert.equal(eheRatesKnown(null), true);
});

test("a cold rate table is distinguishable from an idle player", () => {
  // Same rendered hours, opposite meanings — the flag is the only thing that
  // separates them, which is why it rides on the summary rather than a wrapper.
  const idle = effort({ kills: 0, ehb_hours: 0 });
  const unpriced = effort({ kills: 640, ehb_hours: 0, rates_known: false });
  assert.equal(formatEheHours(idle.ehb_hours), formatEheHours(unpriced.ehb_hours));
  assert.equal(eheRatesKnown(idle.rates_known), true);
  assert.equal(eheRatesKnown(unpriced.rates_known), false);
  // The kills still stand on their own and must keep being shown.
  assert.equal(effortSummary(unpriced), "640 kills");
});


function boss(over: Partial<EventEffortBoss> = {}): EventEffortBoss {
  return {
    npc_id: 15742,
    name: "Yama",
    metric: "yama",
    kills: 0,
    ehb_hours: 0,
    estimated: false,
    frozen: false,
    rolled: null,
    paired: null,
    ...over,
  };
}

test("a clue tier counts caskets, not kills", () => {
  // "25 kills at Clue Scroll (Elite)" reads as a boss nobody has heard of and
  // makes the hours beside it look broken.
  const clue = boss({ name: "Clue Scroll (Elite)", kills: 25, rolled: 20, paired: 20 });
  assert.equal(isClueEffort(clue), true);
  assert.equal(effortKillLabel(clue), "25 caskets");
  assert.equal(effortKillLabel(boss({ kills: 412 })), "412 kills");
  assert.equal(effortKillLabel(boss({ kills: 1 })), "1 kill");
  assert.equal(effortKillLabel(boss({ name: "Clue Scroll (Hard)", kills: 1, paired: 1 })), "1 casket");
});

test("an ordinary boss is never mistaken for a clue tier", () => {
  assert.equal(isClueEffort(boss()), false);
  assert.equal(effortPairNote(boss({ kills: 412 })), undefined);
});

test("the pair note explains where the missing hours went", () => {
  const note = effortPairNote(
    boss({ name: "Clue Scroll (Elite)", kills: 25, rolled: 20, paired: 20 }),
  );
  assert.match(note ?? "", /20 of 25 openings paired/);
  // The dumped-stack case is the one people will actually be looking at.
  const dumped = effortPairNote(
    boss({ name: "Clue Scroll (Elite)", kills: 100, rolled: 0, paired: 0 }),
  );
  assert.match(dumped ?? "", /No hours/);
  assert.match(dumped ?? "", /banked before the event/);
});
