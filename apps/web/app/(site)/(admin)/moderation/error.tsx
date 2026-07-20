"use client";

import { ErrorView } from "@/components/error-view";

export default function ModerationError({
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
      title="Couldn't load the moderation panel"
      message="Something went wrong fetching moderation data. Try again in a moment."
    />
  );
}
