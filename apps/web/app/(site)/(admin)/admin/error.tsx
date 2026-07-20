"use client";

import { ErrorView } from "@/components/error-view";

export default function AdminError({
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
      title="Couldn't load this admin page"
      message="Something went wrong fetching admin data. Try again, or check the service dashboard if this persists."
    />
  );
}
