import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ADMIN_PAGES } from "../lib/admin-nav";

/**
 * /docs/api is published but UNLISTED while the Data API is in limited
 * testing: reachable by direct URL, linked from nowhere. That is a property of
 * several files at once, so it is easy to undo by accident — adding the page
 * to the docs sidebar or the sitemap would "just work" and quietly publish it.
 *
 * Delete this file when the API is announced; until then it is the thing that
 * notices.
 */

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("the page exists", () => {
  const page = read("../app/(site)/(public)/docs/api/page.tsx");
  assert.match(page, /export default function DataApiPage/);
});

test("it is marked noindex", () => {
  const page = read("../app/(site)/(public)/docs/api/page.tsx");
  assert.match(page, /robots:\s*\{\s*index:\s*false/);
});

test("the docs sidebar and index do not list it", () => {
  // lib/docs.ts would surface it through REPO_DOCS/withRepoDocs.
  const docsLib = read("../lib/docs.ts");
  assert.ok(!docsLib.includes("docs/api"));
  assert.ok(!/slug:\s*"api"/.test(docsLib));
});

test("the header nav does not link it", () => {
  assert.ok(!read("../components/site-chrome.tsx").includes("/docs/api"));
});

test("the sitemap does not advertise it", () => {
  assert.ok(!read("../app/sitemap.ts").includes("/docs/api"));
});

test("no admin page links to it either", () => {
  assert.ok(!ADMIN_PAGES.some((p) => p.href.includes("/docs/api")));
});
