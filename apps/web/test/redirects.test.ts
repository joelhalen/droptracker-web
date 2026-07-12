import assert from "node:assert/strict";
import { test } from "node:test";
import { isExternalDestination, type RedirectRule } from "../lib/redirects";
import { isValidSource, resolveRedirect } from "../lib/redirect-resolver";

/** Convenience builder — most fields default to a plain, enabled rule. */
function rule(partial: Partial<RedirectRule> & Pick<RedirectRule, "source" | "destination">): RedirectRule {
  return {
    permanent: false,
    order: 100,
    forward_query: true,
    ...partial,
  };
}

test("exact path match redirects (307 temporary by default)", () => {
  const hit = resolveRedirect("/wiki", "", [rule({ source: "/wiki", destination: "/docs" })]);
  assert.deepEqual(hit, { destination: "/docs", status: 307 });
});

test("permanent rule uses 308", () => {
  const hit = resolveRedirect("/wiki", "", [rule({ source: "/wiki", destination: "/docs", permanent: true })]);
  assert.equal(hit?.status, 308);
});

test("exact match does not match a sub-path", () => {
  const hit = resolveRedirect("/wiki/foo", "", [rule({ source: "/wiki", destination: "/docs" })]);
  assert.equal(hit, null);
});

test("named param is substituted into the destination", () => {
  const hit = resolveRedirect("/players/view/42", "", [
    rule({ source: "/players/view/:id(\\d+)", destination: "/players/:id" }),
  ]);
  assert.equal(hit?.destination, "/players/42");
});

test("custom regex param does not match non-matching input", () => {
  const hit = resolveRedirect("/players/view/bob", "", [
    rule({ source: "/players/view/:id(\\d+)", destination: "/players/:id" }),
  ]);
  assert.equal(hit, null);
});

test("catch-all forwards the remainder joined by '/'", () => {
  const hit = resolveRedirect("/wiki/a/b/c", "", [
    rule({ source: "/wiki/:rest*", destination: "/docs/:rest" }),
  ]);
  assert.equal(hit?.destination, "/docs/a/b/c");
});

test("external URL destination keeps its scheme (colon not treated as a param)", () => {
  const hit = resolveRedirect("/runelite", "", [
    rule({ source: "/runelite", destination: "https://runelite.net/plugin-hub" }),
  ]);
  assert.equal(hit?.destination, "https://runelite.net/plugin-hub");
});

test("external URL destination can still take a param", () => {
  const hit = resolveRedirect("/rl/droptracker", "", [
    rule({ source: "/rl/:name", destination: "https://runelite.net/plugin-hub/show/:name" }),
  ]);
  assert.equal(hit?.destination, "https://runelite.net/plugin-hub/show/droptracker");
});

test("query string is forwarded when forward_query is true", () => {
  const hit = resolveRedirect("/wiki", "q=bandos", [rule({ source: "/wiki", destination: "/docs" })]);
  assert.equal(hit?.destination, "/docs?q=bandos");
});

test("query string is dropped when forward_query is false", () => {
  const hit = resolveRedirect("/wiki", "q=bandos", [
    rule({ source: "/wiki", destination: "/docs", forward_query: false }),
  ]);
  assert.equal(hit?.destination, "/docs");
});

test("forwarded query merges with a destination that already has one", () => {
  const hit = resolveRedirect("/players/view/bob", "ref=x", [
    rule({ source: "/players/view/:name", destination: "/search?q=:name" }),
  ]);
  assert.equal(hit?.destination, "/search?q=bob&ref=x");
});

test("lower order wins when multiple rules match", () => {
  const hit = resolveRedirect("/x", "", [
    rule({ source: "/x", destination: "/late", order: 200 }),
    rule({ source: "/x", destination: "/early", order: 10 }),
  ]);
  assert.equal(hit?.destination, "/early");
});

test("self-loop is skipped (does not redirect a path to itself)", () => {
  const hit = resolveRedirect("/docs", "", [rule({ source: "/docs", destination: "/docs" })]);
  assert.equal(hit, null);
});

test("no match returns null", () => {
  const hit = resolveRedirect("/nothing", "", [rule({ source: "/wiki", destination: "/docs" })]);
  assert.equal(hit, null);
});

test("invalid source patterns are ignored rather than throwing", () => {
  const hit = resolveRedirect("/wiki", "", [
    rule({ source: "/(", destination: "/broken" }),
    rule({ source: "/wiki", destination: "/docs" }),
  ]);
  assert.equal(hit?.destination, "/docs");
});

test("isValidSource / isExternalDestination helpers", () => {
  assert.equal(isValidSource("/players/view/:id(\\d+)"), true);
  assert.equal(isValidSource("no-leading-slash"), false);
  assert.equal(isValidSource("/("), false);
  assert.equal(isExternalDestination("https://runelite.net"), true);
  assert.equal(isExternalDestination("/docs"), false);
});
