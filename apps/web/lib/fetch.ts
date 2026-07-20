import { notFound } from "next/navigation";
import { ApiError } from "./api";

/**
 * Await a BFF fetch, translating a Web API 404 into Next's `notFound()` (a real
 * 404 page) while letting other failures bubble to the nearest `error.tsx`
 * boundary. Use for by-id resource loads (players, groups, events).
 *
 * The status check must come first: `apiError()` replaces the message with the
 * RFC-7807 `detail`/`title` (e.g. "No event 9999999."), which rarely contains
 * the literal "404" — the regex only catches non-ApiError throws.
 */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    if (err instanceof Error && /\b404\b/.test(err.message)) notFound();
    throw err;
  }
}
