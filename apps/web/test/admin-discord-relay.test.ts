import assert from "node:assert/strict";
import { test } from "node:test";
import { ADMIN_PAGES, sectionsForRole } from "../lib/admin-nav";
import {
  DiscordRelayIntegrationSchema,
  DiscordRelayListSchema,
  DiscordRelayLogSchema,
} from "@droptracker/api-types";

// A staff page missing from the nav is invisible (see admin-api-keys.test.ts).
test("the Discord relay page is registered for developers and superadmins", () => {
  assert.ok(ADMIN_PAGES.some((p) => p.href === "/admin/discord-relay"));
  for (const role of ["developer", "superadmin"] as const) {
    const hrefs = sectionsForRole(role).flatMap((s) => s.items.map((i) => i.href));
    assert.ok(hrefs.includes("/admin/discord-relay"), role);
  }
});

// The exact shape web_api/routes/discord_relay_admin.py serialises, including
// Redis stats as strings (counters) next to ints (queue lengths).
const ROW = {
  id: 2, group_id: 10000001, group_name: "Bug Testers", label: "relay-e2e",
  application_id: "1088910298305548409", guild_ids: ["1436315863434133598"],
  features: ["events"], status: "active", hold_minutes: 360, notes: null,
  created_at: "2026-10-30T11:00:00", updated_at: "2026-10-30T11:50:00",
  api_key: { id: 9, display: "dtk_9_ca515bf6...", revoked: false, last_used_at: null },
  stats: { last_poll: "1793360686", last_ack: "1793360524", sent: "20", pending: 0, leased: 0 },
};

test("a listed relay parses, with Redis counters coerced to numbers", () => {
  const parsed = DiscordRelayListSchema.parse({ integrations: [ROW], features: ["events", "notifications"] });
  const r = parsed.integrations[0]!;
  assert.equal(r.stats?.sent, 20);
  assert.equal(r.stats?.last_poll, 1793360686);
  assert.equal(r.token, undefined);
});

test("stats may be empty (Redis down) and still parse", () => {
  const r = DiscordRelayIntegrationSchema.parse({ ...ROW, stats: {} });
  assert.equal(r.stats?.pending, 0);
});

test("create returns the token once; a relay with no key parses", () => {
  const created = DiscordRelayIntegrationSchema.parse({ ...ROW, stats: undefined, token: "dtk_9_x", warning: "once" });
  assert.equal(created.token, "dtk_9_x");
  assert.equal(DiscordRelayIntegrationSchema.parse({ ...ROW, api_key: null }).api_key, null);
});

test("the delivery log parses", () => {
  const log = DiscordRelayLogSchema.parse({
    entries: [{ id: 21, op: "edit", status: "failed", channel_id: "1", ref: "event_board:70",
                error: "HTTP 404 code 10008", at: 1793360759 }],
    stats: { pending: 0, leased: 0 },
  });
  assert.equal(log.entries[0]!.status, "failed");
});
