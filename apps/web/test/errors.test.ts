import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getErrorMessage,
  isStaleDeploymentError,
  STALE_DEPLOYMENT_MESSAGE,
  unwrapActionResult,
} from "../lib/errors";

/** Stand-in for Next's client-side UnrecognizedActionError, which we match by name. */
function unrecognizedActionError(actionId = "609d214962dd3156ec5580f2c508b75dc6d96582d3") {
  const err = new Error(
    `Server Action "${actionId}" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action`,
  );
  err.name = "UnrecognizedActionError";
  return err;
}

test("isStaleDeploymentError only matches the deploy-skew error", () => {
  assert.equal(isStaleDeploymentError(unrecognizedActionError()), true);
  assert.equal(isStaleDeploymentError(new Error("Boom")), false);
  assert.equal(isStaleDeploymentError(new TypeError("fetch failed")), false);
  // A message that merely mentions an action is not the skew error.
  assert.equal(isStaleDeploymentError(new Error("Server Action failed")), false);
  assert.equal(isStaleDeploymentError("UnrecognizedActionError"), false);
  assert.equal(isStaleDeploymentError(null), false);
  assert.equal(isStaleDeploymentError(undefined), false);
});

test("getErrorMessage replaces the raw Next.js skew text with reload guidance", () => {
  const msg = getErrorMessage(unrecognizedActionError());
  assert.equal(msg, STALE_DEPLOYMENT_MESSAGE);
  // The action hash and the Next.js docs link never reach the user.
  assert.ok(!/609d2149|nextjs\.org/.test(msg));
  assert.match(msg, /[Rr]eload/);
  // Beats the caller's fallback, which would otherwise invite a pointless retry.
  assert.equal(getErrorMessage(unrecognizedActionError(), "Please try again."), STALE_DEPLOYMENT_MESSAGE);
});

test("getErrorMessage still handles ordinary values", () => {
  assert.equal(getErrorMessage(new Error("Group not found")), "Group not found");
  assert.equal(getErrorMessage("plain string"), "plain string");
  assert.equal(getErrorMessage(null, "fallback"), "fallback");
  // Production-redacted Server Action errors fall back rather than leak the digest text.
  assert.equal(
    getErrorMessage(new Error("An error occurred in the Server Components render."), "fallback"),
    "fallback",
  );
});

test("unwrapActionResult passes success through and surfaces the backend message", () => {
  const ok = { ok: true as const, event: { id: 123 } };
  assert.equal(unwrapActionResult(ok), ok);
  const detail = "No pet to award: The drop tables don't list a pet for Phosani's Nightmare.";
  let thrown: unknown;
  try {
    unwrapActionResult({ ok: false, status: 422, message: detail });
  } catch (err) {
    thrown = err;
  }
  // Thrown client-side, so it is not redacted and getErrorMessage keeps it.
  assert.equal(getErrorMessage(thrown, "Couldn't save the competition settings."), detail);
});
