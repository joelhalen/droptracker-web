"use client";

/*
 * Last-resort error boundary: anything that escapes every nested boundary,
 * including a throw from `(site)/layout.tsx` and any error on the chromeless
 * surfaces (`/activity`, `/board-image`), which have no boundary of their own.
 * Without this file those all render Next's unstyled built-in error page.
 *
 * Deliberately NOT wrapped in SiteChrome, unlike the root 404/401/403
 * boundaries: the most likely way to reach this file is the site chrome itself
 * failing to render, and re-rendering it here would just throw again. Errors in
 * the root layout are still out of reach for any error.tsx — that needs
 * global-error.tsx.
 */
import { ErrorView } from "@/components/error-view";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ErrorView error={error} reset={reset} />
    </div>
  );
}
