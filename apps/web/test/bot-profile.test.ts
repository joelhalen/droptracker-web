import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AdminBotProfilesResponseSchema,
  BotProfileInputSchema,
  BotProfileSchema,
  ENTITLEMENT_FIELDS,
} from "@droptracker/api-types";
import { botProfileImages } from "../lib/bot-profile";
import { ADMIN_PAGES } from "../lib/admin-nav";

const profile = {
  entitled: true,
  nick: "Loot Goblin",
  bio: null,
  avatar_url: "https://videos.droptracker.io/dt_uploads/bot_profiles/7-avatar-abc.png",
  banner_url: null,
  applied: { nick: "Loot Goblin", bio: null, avatar_url: null, banner_url: null },
  status: "pending",
  defaults: {
    name: "DropTracker.io",
    avatar_url: "https://cdn.discordapp.com/avatars/1/a_x.gif?size=256",
    banner_url: null,
    bio: "Track your drops.",
  },
  last_error: null,
  applied_at: null,
  updated_at: 1761123456,
  limits: {
    nick_max: 32,
    bio_max: 190,
    bio_max_lines: 6,
    avatar_size: [512, 512],
    banner_size: [960, 384],
    image_cooldown_seconds: 600,
  },
};

test("bot profile payload parses, unknown status falls back to default", () => {
  assert.equal(BotProfileSchema.parse(profile).status, "pending");
  assert.equal(BotProfileSchema.parse({ ...profile, status: "weird" }).status, "default");
});

test("admin gallery payload parses with history", () => {
  const parsed = AdminBotProfilesResponseSchema.parse({
    profiles: [
      {
        ...profile,
        group_id: 7,
        group_name: "Iron Gang",
        guild_id: "111",
        updated_by_user_id: 3,
        updated_by_name: "andy",
        history: [
          { action: "bot_profile.update", actor_user_id: 3, before: "{}", after: '{"nick":"x"}', created_at: 1 },
        ],
      },
    ],
  });
  assert.equal(parsed.profiles[0]?.history.length, 1);
});

test("a save can set or clear the images", () => {
  const parsed = BotProfileInputSchema.parse({ nick: null, bio: null, avatar_url: "https://x/a.png", banner_url: null });
  assert.equal(parsed.avatar_url, "https://x/a.png");
  assert.equal(parsed.banner_url, null);
});

test("nickname input is capped at Discord's 32 characters", () => {
  assert.ok(BotProfileInputSchema.safeParse({ nick: "x".repeat(32) }).success);
  assert.ok(!BotProfileInputSchema.safeParse({ nick: "x".repeat(33) }).success);
});

test("audit thumbnails only pick http image urls from bot profile payloads", () => {
  const imgs = botProfileImages('{"avatar_url":"https://a/x.png","banner_url":null,"nick":"G"}');
  assert.deepEqual(imgs, [{ key: "avatar_url", url: "https://a/x.png" }]);
  assert.deepEqual(botProfileImages('{"avatar_url":"javascript:alert(1)"}'), []);
  assert.deepEqual(botProfileImages("not json"), []);
  assert.deepEqual(botProfileImages(null), []);
});

test("entitlement and staff page are registered", () => {
  assert.ok(ENTITLEMENT_FIELDS.some((f) => f.key === "custom_bot_profile"));
  const page = ADMIN_PAGES.find((p) => p.href === "/admin/bot-profiles");
  assert.equal(page?.minRole, "developer");
});
