import assert from "node:assert/strict";
import { test } from "node:test";
import { safeReturnPath } from "../lib/session";

test("plain in-site paths pass through", () => {
  assert.equal(safeReturnPath("/events/42"), "/events/42");
  assert.equal(safeReturnPath("/groups/2/admin?tab=members"), "/groups/2/admin?tab=members");
  assert.equal(safeReturnPath("/"), "/");
});

test("missing / empty values fall back to home", () => {
  assert.equal(safeReturnPath(null), "/");
  assert.equal(safeReturnPath(undefined), "/");
  assert.equal(safeReturnPath(""), "/");
});

test("absolute URLs are rejected (open-redirect guard)", () => {
  assert.equal(safeReturnPath("https://evil.com/phish"), "/");
  assert.equal(safeReturnPath("http://evil.com"), "/");
  assert.equal(safeReturnPath("javascript:alert(1)"), "/");
});

test("protocol-relative and backslash variants are rejected", () => {
  assert.equal(safeReturnPath("//evil.com"), "/");
  assert.equal(safeReturnPath("/\\evil.com"), "/");
});
