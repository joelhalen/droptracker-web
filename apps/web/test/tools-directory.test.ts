import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { TOOL_SECTIONS, TOOL_SECTION_IDS, ToolDirectorySchema } from "../lib/tools-directory";

const listing = {
  id: 1,
  slug: "wise-old-man",
  name: "Wise Old Man",
  section: "progress",
  summary: "Open-source progress tracker.",
  details: null,
  fit_label: "Syncs rosters",
  fit_note: null,
  tags: ["Open source"],
  links: [{ label: "wiseoldman.net", href: "https://wiseoldman.net" }],
  logo_url: null,
  accent: "#3b82f6",
  sort_order: 10,
  visible: true,
  can_edit: false,
  updated_at: null,
};

test("directory payload parses, with maintainers only when sent", () => {
  const parsed = ToolDirectorySchema.parse({ listings: [listing], can_admin: false });
  assert.equal(parsed.listings[0]!.maintainers, undefined);
  const withMaintainers = ToolDirectorySchema.parse({
    listings: [{ ...listing, can_edit: true, maintainers: [{ user_id: 0, username: "joelhalen" }] }],
    can_admin: true,
  });
  assert.equal(withMaintainers.listings[0]!.maintainers![0]!.user_id, 0);
});

test("an unknown section is refused", () => {
  assert.throws(() => ToolDirectorySchema.parse({ listings: [{ ...listing, section: "x" }], can_admin: false }));
});

test("section copy has no em-dashes", () => {
  for (const s of TOOL_SECTIONS) {
    assert.ok(!`${s.title} ${s.blurb}`.includes("—"), s.id);
  }
});

const here = dirname(fileURLToPath(import.meta.url));

// The backend keeps its own copy of the section keys; when this box has the
// backend checked out beside the web repo, make sure the two agree.
test("sections match the backend's", { skip: !existsSync(resolve(here, "../../../../disc")) }, () => {
  const py = readFileSync(resolve(here, "../../../../disc/web_api/community_listings.py"), "utf8");
  const match = py.match(/^SECTIONS = \(([^)]*)\)/m);
  assert.ok(match, "SECTIONS tuple not found");
  const keys = [...match[1]!.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual(keys, [...TOOL_SECTION_IDS]);
});
