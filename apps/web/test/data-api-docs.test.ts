import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ENDPOINTS, SECTIONS } from "../lib/api-reference";
import {
  allExamples,
  curlFor,
  endpointExample,
  example,
  sectionExample,
} from "../lib/api-examples";

/**
 * /docs/api is public (web163a): listed in the docs, indexable, and the place
 * the key-request pages send people. It promises a real response for every
 * endpoint and section, so a section added to the reference without capturing
 * its example (disc: scripts/capture_api_examples.py --write) fails here.
 */

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("the page is indexable", () => {
  const page = read("../app/(site)/(public)/docs/api/page.tsx");
  assert.match(page, /export default function DataApiPage/);
  assert.ok(!/robots:/.test(page));
});

test("the docs sidebar, the docs index and the sitemap list it", () => {
  assert.ok(read("../components/docs-sidebar.tsx").includes("/docs/api"));
  assert.ok(read("../app/(site)/(public)/docs/page.tsx").includes("/docs/api"));
  assert.ok(read("../app/sitemap.ts").includes("/docs/api"));
});

test("the page says where a key comes from", () => {
  const page = read("../app/(site)/(public)/docs/api/page.tsx");
  assert.ok(page.includes("/api-keys"));
  assert.ok(page.includes("API access"));
});

test("every documented endpoint has a captured response", () => {
  for (const endpoint of ENDPOINTS) {
    const ex = endpointExample(endpoint.path);
    assert.ok(ex, `${endpoint.path} has no example`);
    assert.equal(ex.status, 200, `${endpoint.path} example is not a success`);
  }
});

test("every section has a captured response, bar the two that emit nothing alone", () => {
  // identity rides on every response; drop_ids only adds a field to drops.
  for (const section of SECTIONS) {
    if (section.key === "identity" || section.key === "drop_ids") continue;
    const ex = sectionExample(section.key);
    assert.ok(ex, `section ${section.key} has no example`);
    assert.ok(ex.body.includes(`"${section.key}"`), `${section.key} example lacks its own key`);
  }
});

test("the drops example carries drop_id, which the docs promise with drop_ids", () => {
  assert.match(sectionExample("drops")!.body, /"drop_id": \d+/);
});

test("the error examples are real errors", () => {
  assert.equal(example("error_scope")!.status, 403);
  assert.equal(example("error_section")!.status, 400);
});

test("no example leaks a credential or a real Discord id", () => {
  for (const ex of allExamples()) {
    assert.ok(!/dtk_\d+_[0-9a-f]{16}/.test(ex.body), `${ex.id} contains a key`);
    for (const match of ex.body.matchAll(/"discord_id": "(\d+)"/g)) {
      assert.equal(match[1], "123456789012345678", `${ex.id} has a real discord id`);
    }
  }
});

test("a captured request renders as a curl command with the bearer header", () => {
  const curl = curlFor(example("meta")!);
  assert.match(curl, /^curl -H "Authorization: Bearer \$DT_API_KEY"/);
  assert.ok(curl.includes("https://api.droptracker.io/v2/meta"));
});
