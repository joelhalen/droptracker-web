import assert from "node:assert/strict";
import { test } from "node:test";
import { externalUrl, SITE_ORIGIN } from "../lib/activity/external-url";

// The Activity BFF rewrites asset URLs for the iframe's CSP. Handing one of
// those to Discord's openExternalLink would open nothing (or the proxy host),
// so these pin the mapping back to the public address.

test("an absolute site URL opens as-is", () => {
  assert.equal(
    externalUrl("https://www.droptracker.io/docs/events-board"),
    "https://www.droptracker.io/docs/events-board",
  );
});

test("a CSP-rewritten /img path opens on the public site", () => {
  assert.equal(
    externalUrl("/img/user-upload/2026/09/proof.png"),
    `${SITE_ORIGIN}/img/user-upload/2026/09/proof.png`,
  );
});

test("the same-origin image proxy opens the image it wraps", () => {
  const original = "https://video.droptracker.io/proofs/abc 1.png?v=2";
  const proxied = `/api/activity/board-img?u=${encodeURIComponent(original)}`;
  assert.equal(externalUrl(proxied), new URL(original).href);
});

test("a proxy wrapping anything but an absolute URL opens nothing", () => {
  const nested = `/api/activity/board-img?u=${encodeURIComponent("/api/activity/board-img?u=x")}`;
  assert.equal(externalUrl(nested), null);
  assert.equal(externalUrl("/api/activity/board-img"), null);
  assert.equal(
    externalUrl(`/api/activity/board-img?u=${encodeURIComponent("javascript:alert(1)")}`),
    null,
  );
});

test("unsafe or empty input opens nothing", () => {
  assert.equal(externalUrl(""), null);
  assert.equal(externalUrl("   "), null);
  assert.equal(externalUrl(null), null);
  assert.equal(externalUrl(undefined), null);
  assert.equal(externalUrl("javascript:alert(1)"), null);
  assert.equal(externalUrl("data:text/html,hi"), null);
  // Protocol-relative: not a same-origin path, and not absolute either.
  assert.equal(externalUrl("//evil.example/x.png"), null);
  assert.equal(externalUrl("img/relative.png"), null);
});
