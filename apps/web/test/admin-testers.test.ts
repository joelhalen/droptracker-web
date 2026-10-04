import assert from "node:assert/strict";
import { test } from "node:test";
import { AdminTesterBuildsSchema, TesterSchema } from "@droptracker/api-types";
import { ADMIN_PAGES, ADMIN_SECTIONS, sectionsForRole } from "../lib/admin-nav";
import { mockAdminTesterBuilds } from "../lib/mock-data";

// The admin nav is the only index of staff pages: a page that is not
// registered there is invisible, however well it works.
test("the Testers page is registered in the admin nav, under Community", () => {
  assert.ok(ADMIN_PAGES.some((p) => p.href === "/admin/testers"));
  const community = ADMIN_SECTIONS.find((s) => s.label === "Community");
  const item = community?.items.find((i) => i.href === "/admin/testers");
  assert.equal(item?.label, "Testers");
  assert.ok(item?.desc);
});

test("developers can see it: it is a read-only diagnostic view", () => {
  const hrefs = sectionsForRole("developer").flatMap((s) => s.items.map((i) => i.href));
  assert.ok(hrefs.includes("/admin/testers"));
});

test("superadmins see it too", () => {
  const hrefs = sectionsForRole("superadmin").flatMap((s) => s.items.map((i) => i.href));
  assert.ok(hrefs.includes("/admin/testers"));
});

test("a pipeline state this site does not know reads as unknown", () => {
  // The build job lives outside these repos. A new state must not take the
  // staff page down, which is the page staff would open to see what changed.
  const parsed = AdminTesterBuildsSchema.parse({
    ...mockAdminTesterBuilds(),
    status: { state: "queued" },
  });
  assert.equal(parsed.status.state, "unknown");
  assert.equal(parsed.status.checked_at, null);
  assert.equal(parsed.status.error, null);
});

test("the staff payload parses before anything has been built", () => {
  const parsed = AdminTesterBuildsSchema.parse({
    status: {
      state: "unknown",
      checked_at: null,
      ref: null,
      head_commit: null,
      runelite_version: null,
      error: null,
      current_build_id: null,
    },
    current: null,
    release_version: null,
    builds: [],
    testers: [],
    recent_downloads: [],
  });
  assert.equal(parsed.current, null);
  assert.deepEqual(parsed.builds, []);
});

test("a tester who never downloaded and was never seen still parses", () => {
  const parsed = TesterSchema.parse({
    // user_id 0 is a real account; it must survive as 0, not as "missing".
    user_id: 0,
    discord_id: null,
    username: null,
    players: [],
    download_count: 0,
    last_download: null,
    has_current: false,
    seen: null,
    tested_versions: [],
  });
  assert.equal(parsed.user_id, 0);
  assert.equal(parsed.last_download, null);
  assert.equal(parsed.seen, null);
});
