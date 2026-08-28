import assert from "node:assert/strict";
import { test } from "node:test";
import { ADMIN_PAGES, sectionsForRole } from "../lib/admin-nav";
import { ApiKeySchema, ApiKeyTierSchema, ApiUsageWindowSchema } from "@droptracker/api-types";

// The admin nav is the only index of staff pages, so a page that is not
// registered is effectively invisible — which is exactly how the Data API
// shipped to production with no way to manage its keys.
test("the Data API keys page is registered in the admin nav", () => {
  assert.ok(ADMIN_PAGES.some((p) => p.href === "/admin/api-keys"));
});

test("developers can see it — it is the who-is-slow diagnostic view", () => {
  const hrefs = sectionsForRole("developer").flatMap((s) => s.items.map((i) => i.href));
  assert.ok(hrefs.includes("/admin/api-keys"));
});

test("superadmins see it too", () => {
  const hrefs = sectionsForRole("superadmin").flatMap((s) => s.items.map((i) => i.href));
  assert.ok(hrefs.includes("/admin/api-keys"));
});

test("a minted key carries the token, a listed key does not", () => {
  const base = {
    id: 1, label: "x", state: "active" as const, tier: "standard",
    owner_type: "group" as const, owner_user_id: null, group_id: 7,
    display: "dtk_1_abc...", created_at: null, last_used_at: null,
    expires_at: null, revoked_at: null, overrides: {},
  };
  assert.equal(ApiKeySchema.parse(base).token, undefined);
  assert.equal(ApiKeySchema.parse({ ...base, token: "dtk_1_secret" }).token, "dtk_1_secret");
});

test("overrides are optional per field, so a key can override just one limit", () => {
  const parsed = ApiKeySchema.parse({
    id: 1, label: "", state: "active", tier: "standard", owner_type: "user",
    owner_user_id: 0, group_id: null, display: "dtk_1_a...", created_at: null,
    last_used_at: null, expires_at: null, revoked_at: null,
    overrides: { cost_units_per_min: 500_000 },
  });
  assert.equal(parsed.overrides.cost_units_per_min, 500_000);
  assert.equal(parsed.overrides.requests_per_min, undefined);
  // user_id 0 is a real account id here — never truthiness-test it.
  assert.equal(parsed.owner_user_id, 0);
});

test("a tier reports how many live keys depend on it", () => {
  const tier = ApiKeyTierSchema.parse({
    tier_key: "standard", display_name: "Standard", requests_per_min: 60,
    cost_units_per_min: 200_000, requests_per_day: 10_000, max_concurrency: 4,
    enabled: true, sort_order: 0, active_keys: 3,
  });
  assert.equal(tier.active_keys, 3);
});

test("an unavailable usage window parses rather than throwing", () => {
  // Redis being down must degrade to 'we cannot tell', not to an error page
  // and not to zeros that read as 'nobody called'.
  const w = ApiUsageWindowSchema.parse({ available: false, hours: 24 });
  assert.equal(w.available, false);
  assert.deepEqual(w.keys, []);
  assert.deepEqual(w.totals, {});
});

test("a global key parses with no owner", () => {
  // The wire shape for a third-party integration key: scope global, both
  // owner columns null. If the schema demanded an owner the ACP could not
  // render one.
  const parsed = ApiKeySchema.parse({
    id: 9, label: "partner site", state: "active", tier: "standard",
    scope: "global", owner_type: "global", owner_user_id: null, group_id: null,
    display: "dtk_9_abc...", created_at: null, last_used_at: null,
    expires_at: null, revoked_at: null, overrides: {},
  });
  assert.equal(parsed.scope, "global");
  assert.equal(parsed.group_id, null);
  assert.equal(parsed.owner_user_id, null);
});

test("scope defaults to group for rows predating the column", () => {
  const parsed = ApiKeySchema.parse({
    id: 1, label: "", state: "active", tier: "standard",
    owner_type: "group", owner_user_id: null, group_id: 7,
    display: "dtk_1_a...", created_at: null, last_used_at: null,
    expires_at: null, revoked_at: null, overrides: {},
  });
  // Never 'global' by default — the widest scope is only ever explicit.
  assert.equal(parsed.scope, "group");
});

test("a mint response can carry a one-time link instead of a bare token", () => {
  // When the key is delivered by link, the ACP shows the URL (and whether the
  // DM landed) rather than expecting the operator to relay the secret.
  const parsed = ApiKeySchema.parse({
    id: 11, label: "partner", state: "active", tier: "standard",
    scope: "group", owner_type: "group", owner_user_id: null, group_id: 7,
    display: "dtk_11_a...", created_at: null, last_used_at: null,
    expires_at: null, revoked_at: null, overrides: {},
    token: "dtk_11_secret",
    reveal_url: "https://www.droptracker.io/api-keys/claim/abc",
    reveal_dm_sent: true,
  });
  assert.equal(parsed.reveal_url, "https://www.droptracker.io/api-keys/claim/abc");
  assert.equal(parsed.reveal_dm_sent, true);
});

test("a plain mint response is still valid without the reveal fields", () => {
  const parsed = ApiKeySchema.parse({
    id: 12, label: "", state: "active", tier: "standard",
    scope: "group", owner_type: "group", owner_user_id: null, group_id: 7,
    display: "dtk_12_a...", created_at: null, last_used_at: null,
    expires_at: null, revoked_at: null, overrides: {},
  });
  assert.equal(parsed.reveal_url, undefined);
});
