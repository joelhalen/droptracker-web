import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ENTITLEMENT_FIELDS,
  GroupEmbedInputSchema,
  GroupEmbedsResponseSchema,
  NotificationFootersSchema,
  type NotificationFooters,
} from "@droptracker/api-types";
import { FALLBACK_FOOTER, resolveFooter } from "../lib/notification-footers";
import { mockGroupEmbeds, mockNotificationFooters } from "../lib/mock-data";

const base: NotificationFooters = {
  entitled: true,
  default_footer: "DT",
  footer_types: ["drop", "pet", "pet_dupe", "level_up", "xp_milestone", "pb"],
  fallback_types: { pet_dupe: "pet", xp_milestone: "level_up" },
  all: null,
  types: {},
};

test("custom_footer is a registered entitlement", () => {
  assert.ok(ENTITLEMENT_FIELDS.some((f) => f.key === "custom_footer"));
});

test("no choices sends the DropTracker footer", () => {
  assert.equal(resolveFooter(base, "drop"), "DT");
  assert.equal(resolveFooter(null, "drop"), FALLBACK_FOOTER);
});

test("type choice beats its fallback type, which beats every-notification", () => {
  const f = {
    ...base,
    all: { mode: "custom" as const, text: "Clan" },
    types: {
      pet: { mode: "none" as const, text: null },
      pb: { mode: "default" as const, text: null },
    },
  };
  assert.equal(resolveFooter(f, "drop"), "Clan");
  assert.equal(resolveFooter(f, "pet"), null);
  assert.equal(resolveFooter(f, "pet_dupe"), null);
  assert.equal(resolveFooter(f, "pb"), "DT");
});

test("without the entitlement the saved choices are not sent", () => {
  const f = { ...base, entitled: false, all: { mode: "none" as const, text: null } };
  assert.equal(resolveFooter(f, "drop"), "DT");
});

test("mocks parse", () => {
  NotificationFootersSchema.parse(mockNotificationFooters());
  GroupEmbedsResponseSchema.parse(mockGroupEmbeds());
});

test("message text refuses @everyone and @here but allows roles", () => {
  const embed = { title: "t", description: "", fields: [] };
  assert.ok(
    GroupEmbedInputSchema.safeParse({ ...embed, content: "<@&1> {player_mention}" }).success,
  );
  assert.ok(GroupEmbedInputSchema.safeParse({ ...embed, content: null }).success);
  assert.ok(!GroupEmbedInputSchema.safeParse({ ...embed, content: "@everyone look" }).success);
  assert.ok(!GroupEmbedInputSchema.safeParse({ ...embed, content: "hi @here" }).success);
});
