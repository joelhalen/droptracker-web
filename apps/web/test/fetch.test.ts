import assert from "node:assert/strict";
import { test } from "node:test";
import { orNotFound } from "../lib/fetch";
import { ApiError } from "../lib/api";

/**
 * `notFound()` throws a framework-internal error distinguished by its digest.
 * Match both spellings so a Next minor bump doesn't break the suite
 * ("NEXT_NOT_FOUND" pre-15.1, "NEXT_HTTP_ERROR_FALLBACK;404" after).
 */
function isNotFoundThrow(err: unknown): boolean {
  const digest = (err as { digest?: string })?.digest ?? "";
  return /^(NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK;404)$/.test(digest);
}

test("resolves with the value when the fetch succeeds", async () => {
  assert.deepEqual(await orNotFound(Promise.resolve({ id: 7 })), { id: 7 });
});

test("ApiError 404 triggers notFound() even without '404' in the message", async () => {
  // Real-world shape: apiError() replaces the message with the RFC-7807
  // detail ("No event 9999999."), which contains no "404".
  const err = new ApiError(404, "No event 9999999.");
  await assert.rejects(orNotFound(Promise.reject(err)), isNotFoundThrow);
});

test("ApiError with a non-404 status rethrows the original error", async () => {
  const err = new ApiError(500, "Web API 500 for /events/1");
  await assert.rejects(orNotFound(Promise.reject(err)), (thrown: unknown) => thrown === err);
});

test("plain Error mentioning 404 still triggers notFound() (legacy fallback)", async () => {
  const err = new Error("Web API 404 for /players/1");
  await assert.rejects(orNotFound(Promise.reject(err)), isNotFoundThrow);
});

test("plain Error without 404 rethrows", async () => {
  const err = new Error("connect ECONNREFUSED");
  await assert.rejects(orNotFound(Promise.reject(err)), (thrown: unknown) => thrown === err);
});
