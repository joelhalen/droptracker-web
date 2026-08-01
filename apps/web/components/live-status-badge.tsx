"use client";

/**
 * Connection indicator for surfaces fed by `useEventStream`. Mirrors the
 * leaderboard's live label so a viewer can tell a quiet board from a dead
 * connection — without it, a dropped stream looks identical to "nothing is
 * happening" until the page is reloaded.
 */
export function LiveStatusBadge({
  state,
  className = "",
}: {
  state: "connecting" | "open" | "closed";
  className?: string;
}) {
  return (
    <span
      className={`text-xs whitespace-nowrap ${
        state === "open" ? "text-osrs-green" : "text-osrs-parchment-dark/60"
      } ${className}`}
      aria-live="polite"
    >
      {state === "open" ? "● live" : state === "connecting" ? "○ connecting" : "○ offline"}
    </span>
  );
}
