/**
 * Detecting the missing-icon placeholder — `lib/item-icon.ts`.
 *
 * The signal has to come from the image body's intrinsic size because nothing
 * else is reachable: an `<img>` cannot read the 404 status or the
 * `X-DT-Placeholder` header, and a browser that decodes the body fires `load`
 * rather than `error`. These tests pin the one fact that makes the check safe —
 * 1x1 is a size no real OSRS sprite has — and the loading case, which must not
 * be mistaken for a placeholder.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { PLACEHOLDER_INTRINSIC_SIZE, isPlaceholderIcon } from "@/lib/item-icon";

test("a 1x1 image is the placeholder", () => {
  assert.equal(isPlaceholderIcon({ naturalWidth: 1, naturalHeight: 1 }), true);
});

test("a real item sprite is not", () => {
  // Every OSRS item icon in the itemdb tree is 36x32.
  assert.equal(isPlaceholderIcon({ naturalWidth: 36, naturalHeight: 32 }), false);
});

test("an equipment slot tile is not", () => {
  assert.equal(isPlaceholderIcon({ naturalWidth: 36, naturalHeight: 36 }), false);
});

test("an image that has not loaded yet is not a placeholder", () => {
  // onLoad can be reached with zeroed dimensions; treating that as a
  // placeholder would hide icons that were about to render fine.
  assert.equal(isPlaceholderIcon({ naturalWidth: 0, naturalHeight: 0 }), false);
});

test("missing or partial dimensions are not a placeholder", () => {
  assert.equal(isPlaceholderIcon(null), false);
  assert.equal(isPlaceholderIcon(undefined), false);
  assert.equal(isPlaceholderIcon({}), false);
  // One dimension matching is not enough — a 1x32 sliver is still not it.
  assert.equal(isPlaceholderIcon({ naturalWidth: 1, naturalHeight: 32 }), false);
  assert.equal(isPlaceholderIcon({ naturalWidth: 36, naturalHeight: 1 }), false);
});

test("the exported size matches what the server sends", () => {
  assert.equal(PLACEHOLDER_INTRINSIC_SIZE, 1);
});
