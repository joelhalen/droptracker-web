/** Client-safe helper to derive a user-facing message from a thrown value. */
export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof Error && err.message) {
    // Server Action errors are redacted to an opaque string in production;
    // surface a friendly fallback in that case.
    if (/server components render|an error occurred/i.test(err.message)) return fallback;
    return err.message;
  }
  if (typeof err === "string" && err) return err;
  return fallback;
}
