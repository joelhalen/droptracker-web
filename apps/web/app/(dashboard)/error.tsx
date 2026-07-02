"use client";

import { ErrorView } from "@/components/error-view";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorView
      error={error}
      reset={reset}
      title="Couldn't load your dashboard"
      message="We couldn't reach your account data. Try again, or sign out and back in if this persists."
    />
  );
}
