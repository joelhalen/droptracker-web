"use client";

/*
 * Error boundary for (site) pages that no nested boundary covers — most
 * importantly the homepage, which is `app/(site)/page.tsx` (directly in this
 * group, NOT in `(public)`), so `(public)/error.tsx` never caught it. Before
 * this file a failed api call on `/` fell all the way through to Next's
 * unstyled built-in error page.
 *
 * Renders below `(site)/layout.tsx`, so the chrome stays up.
 */
import { ErrorView } from "@/components/error-view";

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorView error={error} reset={reset} />;
}
