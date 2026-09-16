import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EmbedDefaultsResponseSchema,
  EventLayoutDefaultsResponseSchema,
  GroupEmbedInputSchema,
  GroupEmbedsResponseSchema,
  NotificationLayoutDefaultsResponseSchema,
  NotificationLayoutEntrySchema,
} from "@droptracker/api-types";
import { ADMIN_PAGES, sectionsForRole } from "../lib/admin-nav";
import {
  defaultReach,
  embedEditorEntries,
  embedUsage,
  eventLayoutEditorEntries,
  notificationLayoutEditorEntries,
  notificationLayoutUsage,
  startingPointReach,
} from "../lib/notification-defaults";
import {
  mockEmbedDefaults,
  mockEventLayoutDefaults,
  mockNotificationLayoutDefaults,
} from "../lib/mock-data";

const hrefsFor = (role: "developer" | "superadmin") =>
  sectionsForRole(role).flatMap((s) => s.items.map((i) => i.href));

// The admin nav is the only index of staff pages.
test("the Default embeds page is in the admin nav", () => {
  assert.ok(ADMIN_PAGES.some((p) => p.href === "/admin/embeds"));
  assert.ok(hrefsFor("superadmin").includes("/admin/embeds"));
});

test("developers do not see it — it changes what every group is sent", () => {
  assert.ok(!hrefsFor("developer").includes("/admin/embeds"));
});

test("the mock payloads match the contract", () => {
  EmbedDefaultsResponseSchema.parse(mockEmbedDefaults());
  EventLayoutDefaultsResponseSchema.parse(mockEventLayoutDefaults());
  NotificationLayoutDefaultsResponseSchema.parse(mockNotificationLayoutDefaults());
});

test("embed defaults reach the editor as its custom/default pair", () => {
  const resp = mockEmbedDefaults();
  const entries = embedEditorEntries(resp);
  GroupEmbedsResponseSchema.parse(entries);
  const drop = entries.embeds.find((e) => e.embed_type === "drop");
  const quest = entries.embeds.find((e) => e.embed_type === "quest");
  // A stored default is what the editor edits; the built-in is what it
  // reverts to, and only the row-less types have one.
  assert.ok(drop?.custom);
  assert.equal(drop?.default, null);
  assert.equal(quest?.custom, null);
  assert.ok(quest?.default);
  assert.deepEqual(embedUsage(resp).drop, { custom: 3, overriding: 1 });
});

test("event layout defaults become saved/base entries", () => {
  const entries = eventLayoutEditorEntries(mockEventLayoutDefaults());
  const started = entries.find((e) => e.message_type === "event_started");
  const ended = entries.find((e) => e.message_type === "event_ended");
  assert.ok(started?.saved);
  assert.equal(ended?.saved, null);
  assert.ok(ended?.base.blocks.length);
});

test("a starting layout is never shown as live", () => {
  const resp = mockNotificationLayoutDefaults();
  const entries = notificationLayoutEditorEntries(resp);
  for (const entry of entries) NotificationLayoutEntrySchema.parse(entry);
  assert.ok(entries.every((e) => e.active === false));
  // Usage still reports the groups that ARE sending components.
  assert.deepEqual(notificationLayoutUsage(resp).pb, { custom: 1, live: 1 });
});

test("reach: nobody keeps their own", () => {
  assert.equal(
    defaultReach("drops template", { custom: 0, overriding: 0 }),
    "Every group is sent this default — none has its own drops template.",
  );
  assert.equal(
    defaultReach("drops template", undefined),
    "Every group is sent this default — none has its own drops template.",
  );
});

test("reach: saved templates without a plan still get the default", () => {
  assert.equal(
    defaultReach("drops template", { custom: 3, overriding: 0 }),
    "Every group is sent this default. 3 groups saved their own drops template, but none is on a plan that sends it.",
  );
});

test("reach: groups sending their own are the exception", () => {
  assert.equal(
    defaultReach("pets template", { custom: 1, overriding: 1 }),
    "Sent to every group except the 1 group that sends its own pets template.",
  );
  assert.equal(
    defaultReach("drops template", { custom: 16, overriding: 4 }),
    "Sent to every group except the 4 groups that send their own drops template. 12 more groups saved one without a plan that sends it, so they get this default.",
  );
  assert.equal(
    defaultReach("drops template", { custom: 2, overriding: 1 }),
    "Sent to every group except the 1 group that sends its own drops template. 1 more group saved one without a plan that sends it, so it gets this default.",
  );
});

test("reach: large counts are grouped", () => {
  assert.match(
    defaultReach("drops template", { custom: 1500, overriding: 1200 }),
    /except the 1,200 groups .* 300 more groups/,
  );
});

test("starting points: only groups without a saved layout are reached", () => {
  assert.equal(
    startingPointReach({ custom: 0, live: 0 }),
    "Groups start from this layout when they design this notification as components. No group has saved its own yet.",
  );
  assert.equal(
    startingPointReach({ custom: 3, live: 1 }),
    "Groups start from this layout when they design this notification as components. 3 groups already saved their own, which this doesn't change (1 sending it now).",
  );
  assert.equal(
    startingPointReach({ custom: 1, live: 0 }),
    "Groups start from this layout when they design this notification as components. 1 group already saved their own, which this doesn't change.",
  );
});

test("an embed may be untitled, as the shipped combat achievement default is", () => {
  const untitled = { title: "", description: "{task_name} ({task_tier})", fields: [] };
  assert.equal(GroupEmbedInputSchema.safeParse(untitled).success, true);
  const fieldsOnly = { title: "", fields: [{ name: "Tier", value: "{task_tier}", inline: true }] };
  assert.equal(GroupEmbedInputSchema.safeParse(fieldsOnly).success, true);
  // …but it must say something.
  const empty = GroupEmbedInputSchema.safeParse({ title: " ", description: "  ", fields: [] });
  assert.equal(empty.success, false);
});
