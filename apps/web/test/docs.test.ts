import assert from "node:assert/strict";
import { test } from "node:test";
import { getAllDocs, getDoc, getDocsByCategory } from "../lib/docs";

// The static MDX docs must load with valid frontmatter (FRONTEND_PLAN.md §19).
test("docs load with required frontmatter and unique slugs", async () => {
  const docs = await getAllDocs();
  assert.ok(docs.length > 0, "expected at least one doc");

  const slugs = new Set<string>();
  for (const d of docs) {
    assert.ok(d.title, `doc ${d.slug} missing title`);
    assert.ok(d.category, `doc ${d.slug} missing category`);
    assert.ok(!slugs.has(d.slug), `duplicate slug ${d.slug}`);
    slugs.add(d.slug);
  }
});

test("getDoc resolves a known slug and rejects unknown", async () => {
  assert.ok(await getDoc("getting-started"), "getting-started should exist");
  assert.equal(await getDoc("does-not-exist"), null);
});

test("docs group by category in sorted order", async () => {
  const groups = await getDocsByCategory();
  assert.ok(groups.length > 0);
  for (const g of groups) {
    const orders = g.docs.map((d) => d.order);
    assert.deepEqual(orders, [...orders].sort((a, b) => a - b), `${g.category} not order-sorted`);
  }
});
