"use client";

import { ErrorView } from "@/components/error-view";

export default function GroupAdminError({
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
      title="Couldn't load group admin"
      message="We couldn't reach this group's data. Try again, or head back to your dashboard."
    />
  );
}
