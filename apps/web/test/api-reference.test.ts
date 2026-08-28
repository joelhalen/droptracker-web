import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BUDGETS,
  ENDPOINTS,
  ERRORS,
  SECTIONS,
  requestCost,
  sectionsByCategory,
} from "../lib/api-reference";

// The Data API reference is repo-versioned data rather than CMS prose, so the
// things that would silently go wrong — a duplicated section key, a cost that
// contradicts the worked examples, an endpoint documented without a method —
// are worth pinning. Parity with the server's own registry cannot be checked
// from this repo; the page says GET /v2/sections is authoritative.

test("section keys are unique", () => {
  const keys = SECTIONS.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("every section has a non-empty summary and a sane cost", () => {
  for (const section of SECTIONS) {
    assert.ok(section.summary.trim().length > 0, `${section.key} has no summary`);
    assert.ok(section.cost >= 0, `${section.key} has a negative cost`);
    assert.ok(Number.isInteger(section.cost), `${section.key} has a fractional cost`);
  }
});

test("meta is free — it is advertised as attachable at no cost", () => {
  const meta = SECTIONS.find((s) => s.key === "meta")!;
  assert.equal(meta.cost, 0);
  assert.equal(requestCost(["identity", "loot", "meta"], 100),
               requestCost(["identity", "loot"], 100));
});

test("identity is free, and it is the only other free section", () => {
  // Identity rides along on every response, so charging for it would make the
  // advertised cost of every other section wrong.
  const free = SECTIONS.filter((s) => s.cost === 0).map((s) => s.key).sort();
  assert.deepEqual(free, ["identity", "meta"]);
});

test("the expensive sections cost more than the cheap ones", () => {
  const cost = (key: string) => SECTIONS.find((s) => s.key === key)!.cost;
  assert.ok(cost("clog_slots") > cost("loot_items"));
  assert.ok(cost("loot_items") > cost("clog"));
  assert.ok(cost("clog") > cost("loot"));
});

test("cost scales by players and sums across sections", () => {
  assert.equal(requestCost(["loot_items"], 100), requestCost(["loot_items"], 1) * 100);
  assert.equal(
    requestCost(["loot", "loot_items"], 1),
    requestCost(["loot"], 1) + requestCost(["loot_items"], 1),
  );
});

test("cost is never zero, even for an identity-only request", () => {
  // A request still costs a connection and a query even when every section
  // it names is free.
  assert.ok(requestCost(["identity"], 1) >= 1);
  assert.ok(requestCost([], 0) >= 1);
});

test("unknown section keys contribute nothing rather than throwing", () => {
  assert.equal(requestCost(["identity", "not_a_section"], 1), requestCost(["identity"], 1));
});

test("a full 100-player page outprices the entry tier's 300 cost units", () => {
  // The page states this as a worked example; if the costs ever change so it
  // is no longer true, the prose becomes a lie.
  const everything = SECTIONS.map((s) => s.key);
  assert.ok(requestCost(everything, 100) > 300);
});

test("a cheap 100-player page stays inside the entry tier", () => {
  assert.ok(requestCost(["identity", "loot"], 100) <= 300);
});

test("every section appears in exactly one display category", () => {
  const grouped = sectionsByCategory().flatMap((g) => g.sections.map((s) => s.key));
  assert.equal(grouped.length, SECTIONS.length);
  assert.deepEqual(new Set(grouped).size, SECTIONS.length);
});

test("categories are ordered with Core first", () => {
  assert.equal(sectionsByCategory()[0]!.category, "Core");
});

test("endpoints are documented with a method, path and summary", () => {
  for (const endpoint of ENDPOINTS) {
    assert.equal(endpoint.method, "GET");
    assert.ok(endpoint.path.startsWith("/v2/"), `${endpoint.path} is not under /v2`);
    assert.ok(endpoint.summary.trim().length > 0, `${endpoint.path} has no summary`);
  }
});

test("health is the only endpoint that does not need a key", () => {
  const open = ENDPOINTS.filter((e) => !e.auth).map((e) => e.path);
  assert.deepEqual(open, ["/v2/health"]);
});

test("documented errors cover the statuses the API actually returns", () => {
  const statuses = ERRORS.map((e) => e.status);
  for (const expected of [400, 401, 403, 404, 429, 503]) {
    assert.ok(statuses.includes(expected), `${expected} is undocumented`);
  }
});

test("every rate-limit budget is named and explained", () => {
  assert.ok(BUDGETS.length >= 4);
  for (const budget of BUDGETS) {
    assert.ok(/^[a-z_]+$/.test(budget.name), `${budget.name} is not a config-style key`);
    assert.ok(budget.description.trim().length > 0);
  }
});
