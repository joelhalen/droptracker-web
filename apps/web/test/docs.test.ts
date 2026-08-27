import assert from "node:assert/strict";
import { test } from "node:test";
import type { DocSummary } from "@droptracker/api-types";
import { groupDocsByCategory, withRepoDocs } from "../lib/docs";

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

// Repo-defined doc pages (e.g. /docs/api) are not in the CMS list, so they are
// merged in explicitly by the sidebar and index rather than by the grouping
// helper — which stays a pure function of its input.
test("withRepoDocs adds the repo-defined pages", () => {
  const merged = withRepoDocs(FIXTURE);
  assert.ok(merged.some((d) => d.slug === "api"));
  assert.equal(merged.length, FIXTURE.length + 1);
});

test("withRepoDocs leaves the CMS entries intact and in order", () => {
  const merged = withRepoDocs(FIXTURE);
  assert.deepEqual(
    merged.filter((d) => d.slug !== "api"),
    FIXTURE,
  );
});

test("a CMS doc cannot shadow a repo route", () => {
  // The repo route wins: a CMS page at that slug is unreachable anyway,
  // because the real folder segment takes precedence over [slug].
  const shadow = { slug: "api", title: "Impostor", description: null, category: "Account", order: 9 };
  const merged = withRepoDocs([...FIXTURE, shadow]);
  const apiEntries = merged.filter((d) => d.slug === "api");
  assert.equal(apiEntries.length, 1);
  assert.equal(apiEntries[0]!.title, "Data API");
});

test("withRepoDocs on an empty CMS list still yields the repo pages", () => {
  assert.ok(withRepoDocs([]).length >= 1);
});
