"use client";

/**
 * Shared client error boundary UI for route-group `error.tsx` files. Keeps a
 * failed data fetch from taking down the whole app and offers a retry.
 */
import { useEffect } from "react";

export function ErrorView({
  error,
  reset,
  title = "Something went wrong",
  message = "We couldn't load this page. The service may be busy — try again in a moment.",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  message?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="border-osrs-bronze/30 mx-auto max-w-lg rounded border px-6 py-12 text-center">
      <h1 className="text-osrs-gold text-2xl font-bold">{title}</h1>
      <p className="text-osrs-parchment-dark/80 mt-3 text-sm">{message}</p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium"
        >
          Try again
        </button>
        <a
          href="/"
          className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-4 py-2 text-sm"
        >
          Back to home
        </a>
      </div>
    </div>
  );
}
