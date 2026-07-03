import assert from "node:assert/strict";
import { test } from "node:test";
import type { DocSummary } from "@droptracker/api-types";
import { groupDocsByCategory } from "../lib/docs";

// Docs pages are DB-backed now (superadmin CMS, /admin/docs) — the only pure,
// unit-testable logic left in lib/docs.ts is this grouping helper. Loading
// itself (api.docs()/api.doc()) needs a live backend, out of scope here.
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
