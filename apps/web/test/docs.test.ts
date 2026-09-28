import assert from "node:assert/strict";
import { test } from "node:test";
import type { DocSummary } from "@droptracker/api-types";
import { docHeadings, docHitHref, groupDocsByCategory, headingSlug, highlightRuns } from "../lib/docs";

// Docs pages are DB-backed (superadmin CMS, /admin/docs). The pure helpers in
// lib/docs.ts (grouping, heading anchors, search-hit links and highlighting)
// are covered here; loading itself (api.docs()/api.doc()) needs a live backend.
const FIXTURE: DocSummary[] = [
  { slug: "getting-started", title: "Getting started", description: null, category: "Getting started", order: 1 },
  { slug: "how-it-works", title: "How it works", description: null, category: "Getting started", order: 2 },
  { slug: "link-account", title: "Linking your account", description: null, category: "Account", order: 1 },
];

test("groups docs by category, preserving input order", () => {
  const groups = groupDocsByCategory(FIXTURE);
  assert.deepEqual(
    groups.map((g) => g.category),
    ["Getting started", "Account"],
  );
  assert.equal(groups[0]?.docs.length, 2);
  assert.equal(groups[1]?.docs.length, 1);
});

test("preserves within-category order (caller is expected to pre-sort)", () => {
  const groups = groupDocsByCategory(FIXTURE);
  const orders = groups[0]?.docs.map((d) => d.order) ?? [];
  assert.deepEqual(orders, [1, 2]);
});

test("empty input yields no groups", () => {
  assert.deepEqual(groupDocsByCategory([]), []);
});

// Same cases as the backend's tests/unit/test_docs_search.py::TestHeadingSlug —
// search hits carry anchors made by the Python twin of this function.
test("headingSlug matches the backend's heading_slug", () => {
  assert.equal(headingSlug("Joining and rules"), "joining-and-rules");
  assert.equal(headingSlug("Chutes & Ladders"), "chutes-ladders");
  assert.equal(headingSlug("My event progress isn't counting."), "my-event-progress-isnt-counting");
  assert.equal(headingSlug("**Bold** [link](/x) `code`"), "bold-link-code");
  assert.equal(headingSlug("  Spaced   out  "), "spaced-out");
});

test("docHeadings lists ## headings, skipping code fences and deeper levels", () => {
  const md = "# Title\n\n## First part\n\ntext\n\n### Sub\n\n```\n## not one\n```\n\n## **Second** part\n";
  assert.deepEqual(docHeadings(md), [
    { text: "First part", id: "first-part" },
    { text: "Second part", id: "second-part" },
  ]);
});

test("docHitHref adds the section anchor when there is one", () => {
  assert.equal(docHitHref({ slug: "events-create", anchor: "tasks" }), "/docs/events-create#tasks");
  assert.equal(docHitHref({ slug: "faq", anchor: null }), "/docs/faq");
});

test("highlightRuns marks word-prefix matches only", () => {
  const runs = highlightRuns("Roll the dice. Ice barrage freezes.", "ice barr");
  assert.deepEqual(
    runs.filter((r) => r.hit).map((r) => r.text),
    ["Ice", "barrage"],
  );
  assert.equal(runs.map((r) => r.text).join(""), "Roll the dice. Ice barrage freezes.");
  assert.deepEqual(highlightRuns("plain", ""), [{ text: "plain", hit: false }]);
});
