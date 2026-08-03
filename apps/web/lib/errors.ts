/** Client-safe helper to derive a user-facing message from a thrown value. */

/** Shown when an action fails only because the tab is running a superseded build. */
export const STALE_DEPLOYMENT_MESSAGE =
  "DropTracker was updated while this page was open, so that request couldn't be delivered. Reload the page to continue.";

/**
 * True when a Server Action failed because the browser is running an older
 * build than the server — not because anything is actually wrong.
 *
 * Each build mints its own Server Action ids, and the blue-green deploy flips
 * nginx to a freshly built colour while old tabs stay open. Those tabs post an
 * action id the live colour has never seen; Next answers 404 +
 * `x-nextjs-action-not-found` and the client router throws an
 * `UnrecognizedActionError`. Nothing reaches the backend, so the fix is always
 * "reload" — never "retry", which is what the raw Next.js text (a bare action
 * hash and a docs link) used to invite.
 *
 * Matched by `name` rather than Next's `unstable_isUnrecognizedActionError`,
 * which is not a stable public export.
 */
export function isStaleDeploymentError(err: unknown): boolean {
  return err instanceof Error && err.name === "UnrecognizedActionError";
}

export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (isStaleDeploymentError(err)) return STALE_DEPLOYMENT_MESSAGE;
  if (err instanceof Error && err.message) {
    // Server Action errors are redacted to an opaque string in production;
    // surface a friendly fallback in that case.
    if (/server components render|an error occurred/i.test(err.message)) return fallback;
    return err.message;
  }
  if (typeof err === "string" && err) return err;
  return fallback;
}
