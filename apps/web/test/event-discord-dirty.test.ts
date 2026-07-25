import assert from "node:assert/strict";
import { test } from "node:test";
import type { EventChannelConfig } from "@droptracker/api-types";
import {
  configToDraft,
  dirtySections,
  sectionFingerprints,
  stableJson,
  type DiscordDraft,
} from "../lib/event-discord-dirty";

/* The event Discord form saves on an explicit button, so a wrong answer here
 * is user-visible in both directions: a false positive nags on every page
 * leave, a false negative silently drops the admin's config. */

const messages: EventChannelConfig["messages"] = {
  toggles: {
    event_started: true,
    event_ended: true,
    event_completion: true,
    event_task_progress: false,
    event_line: true,
    event_blackout: true,
    event_lead_change: true,
    event_pending: true,
    event_activation_failed: true,
  },
  task_progress: "milestones",
  item_details: true,
  leaderboard: { live: false, top_n: 10, show_tasks: true },
};

const config: EventChannelConfig = {
  guild_id: "123",
  guild_name: "Test guild",
  channels: { announcements: "111", completions: "222" },
  discord_event_policy: "on_activate",
  pings: { event_started: ["10", "20"] },
  messages,
  per_group_discord: false,
};

/** The draft the form holds right after applying `config`. */
const draft = (): DiscordDraft => configToDraft(config);

const diff = (d: DiscordDraft, scope: number | null = null) =>
  dirtySections(sectionFingerprints(d, scope), sectionFingerprints(configToDraft(config), scope));

// ── stableJson: order must not matter ────────────────────────────────────────

test("stableJson ignores object key order", () => {
  assert.equal(stableJson({ a: 1, b: 2 }), stableJson({ b: 2, a: 1 }));
  assert.equal(stableJson({ x: { p: 1, q: 2 } }), stableJson({ x: { q: 2, p: 1 } }));
});

test("stableJson keeps array order significant", () => {
  assert.notEqual(stableJson([1, 2]), stableJson([2, 1]));
});

// ── the load case: a freshly applied config is never dirty ───────────────────

test("the server copy applied to the form reads as clean", () => {
  assert.deepEqual(diff(draft()), []);
});

test("a clean form stays clean in a per-clan scope", () => {
  assert.deepEqual(diff(draft(), 7), []);
});

test("nothing is dirty before the first GET lands", () => {
  assert.deepEqual(dirtySections(sectionFingerprints(draft(), null), null), []);
});

// ── real edits are caught, section by section ────────────────────────────────

test("changing the guild flags the channels section", () => {
  assert.deepEqual(diff({ ...draft(), guildId: "999" }), ["channels"]);
});

test("adding, editing and clearing a channel flags the channels section", () => {
  assert.deepEqual(diff({ ...draft(), channels: { ...config.channels, admin: "333" } }), [
    "channels",
  ]);
  assert.deepEqual(diff({ ...draft(), channels: { ...config.channels, announcements: "999" } }), [
    "channels",
  ]);
  assert.deepEqual(diff({ ...draft(), channels: { announcements: "111" } }), ["channels"]);
});

test("changing the scheduled-event policy flags only that section", () => {
  assert.deepEqual(diff({ ...draft(), policy: "immediate" }), ["scheduled"]);
});

test("ping roles flag the section that owns them", () => {
  assert.deepEqual(diff({ ...draft(), pings: { ...config.pings, event_created: ["5"] } }), [
    "scheduled",
  ]);
  assert.deepEqual(diff({ ...draft(), pings: { ...config.pings, event_ended: ["5"] } }), ["pings"]);
});

test("verbosity, leaderboard and per-clan mode are tracked separately", () => {
  assert.deepEqual(
    diff({
      ...draft(),
      messages: { ...messages, toggles: { ...messages.toggles, event_line: false } },
    }),
    ["verbosity"],
  );
  assert.deepEqual(
    diff({ ...draft(), messages: { ...messages, task_progress: "all" } }),
    ["verbosity"],
  );
  assert.deepEqual(
    diff({ ...draft(), messages: { ...messages, leaderboard: { ...messages.leaderboard, live: true } } }),
    ["leaderboard"],
  );
  assert.deepEqual(diff({ ...draft(), perGroup: true }), ["scoping"]);
});

test("several edits at once report every section", () => {
  const changed = diff({ ...draft(), guildId: "999", policy: "immediate", perGroup: true });
  assert.deepEqual(changed.sort(), ["channels", "scheduled", "scoping"]);
});

// ── normalization: churn that isn't a configuration change ───────────────────

test("re-typing a channel id in a different key order is not a change", () => {
  // What the form's setKind() leaves behind after a clear + re-type.
  assert.deepEqual(diff({ ...draft(), channels: { completions: "222", announcements: "111" } }), []);
});

test("toggling a ping role off and back on is not a change", () => {
  assert.deepEqual(diff({ ...draft(), pings: { event_started: ["20", "10"] } }), []);
});

test("whitespace around ids is not a change", () => {
  assert.deepEqual(diff({ ...draft(), guildId: " 123 " }), []);
  assert.deepEqual(diff({ ...draft(), channels: { ...config.channels, announcements: " 111 " } }), []);
});

test("an emptied channel field is not a change", () => {
  // setKind() deletes empties, but a picker clearing to "" must behave too.
  const base: EventChannelConfig = { ...config, channels: { announcements: "111" } };
  const changed = dirtySections(
    sectionFingerprints(
      { ...configToDraft(base), channels: { announcements: "111", admin: "  " } },
      null,
    ),
    sectionFingerprints(configToDraft(base), null),
  );
  assert.deepEqual(changed, []);
});

// ── scope rules: a clan scope only owns its guild, channels and verbosity ────

test("event-level knobs never read as dirty inside a clan scope", () => {
  // A scope switch can leave the shared scope's policy/pings/per-clan values
  // in state; none of them are sent with a group_id, so none may nag.
  assert.deepEqual(
    diff({ ...draft(), policy: "immediate", perGroup: true, pings: { event_ended: ["9"] } }, 7),
    [],
  );
});

test("a clan scope still tracks its own channels and verbosity", () => {
  assert.deepEqual(diff({ ...draft(), channels: { announcements: "999" } }, 7), ["channels"]);
  assert.deepEqual(
    diff({ ...draft(), messages: { ...messages, item_details: false } }, 7),
    ["verbosity"],
  );
});

// ── clearing the guild ───────────────────────────────────────────────────────

test("clearing the guild reports the channels and pings it takes with it", () => {
  // Save sends channels {} and pings {} without a guild, so clearing it
  // really does drop the configured destinations and role pings.
  assert.deepEqual(diff({ ...draft(), guildId: "" }).sort(), ["channels", "pings"]);
});

test("clearing the guild on a config with no pings is a single change", () => {
  const noPings: EventChannelConfig = { ...config, pings: {} };
  const changed = dirtySections(
    sectionFingerprints({ ...configToDraft(noPings), guildId: "" }, null),
    sectionFingerprints(configToDraft(noPings), null),
  );
  assert.deepEqual(changed, ["channels"]);
});

test("a config that never had a guild is clean", () => {
  const empty: EventChannelConfig = {
    guild_id: null,
    channels: {},
    discord_event_policy: "on_activate",
    pings: {},
    messages,
    per_group_discord: false,
  };
  assert.deepEqual(
    dirtySections(
      sectionFingerprints(configToDraft(empty), null),
      sectionFingerprints(configToDraft(empty), null),
    ),
    [],
  );
});
