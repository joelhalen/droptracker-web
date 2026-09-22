"use client";

/**
 * Dismissible banner for failed Discord sign-ins. The OAuth routes redirect to
 * `/?auth=<code>` on failure (app/api/auth/callback/route.ts: `error`,
 * `state_mismatch`, `exchange_failed`) but the homepage never surfaced it.
 * The homepage is static/ISR, so the query param is read in this client
 * island via useSearchParams — the server component must not touch
 * searchParams or it opts the whole page out of static rendering.
 */
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui";

const MESSAGES: Record<string, string> = {
  error: "Sign-in didn't complete. Please try again.",
  state_mismatch: "That sign-in attempt expired or was already used. Please try again.",
  exchange_failed: "Discord sign-in failed on our end. Please try again in a moment.",
};
const GENERIC = "Sign-in didn't complete. Please try again.";

function Banner({ className }: { className: string }) {
  const router = useRouter();
  const code = useSearchParams().get("auth");
  const [dismissed, setDismissed] = useState(false);
  if (!code || dismissed) return null;

  return (
    <Alert variant="error" className={`flex items-center justify-between gap-3 ${className}`}>
      <span>{MESSAGES[code] ?? GENERIC}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          // Hide immediately, then drop ?auth= so a refresh doesn't resurrect it.
          setDismissed(true);
          router.replace("/", { scroll: false });
        }}
        className="hover:text-osrs-gold-bright shrink-0 cursor-pointer transition-colors"
      >
        ✕
      </button>
    </Alert>
  );
}

/** useSearchParams needs a Suspense boundary when the page is prerendered. */
export function AuthErrorBanner({ className = "" }: { className?: string }) {
  return (
    <Suspense fallback={null}>
      <Banner className={className} />
    </Suspense>
  );
}
