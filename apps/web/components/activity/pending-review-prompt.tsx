"use client";

/**
 * Boot-time pop-up for event admins: "you have completions awaiting review".
 *
 * Fetched once per launch (session holders only — the backend returns events
 * the user actually administers). Dismissing is per-launch state: "Not now"
 * just closes it; relaunching the activity re-checks. Suppressed while a
 * review screen is already on the nav stack (the user deep-linked straight
 * into the queue — prompting again would be noise).
 */
import { useEffect, useMemo, useState } from "react";
import type { PendingReviewEvent } from "@droptracker/api-types";
import { useActivityAuth } from "@/lib/activity/auth-context";
import { useActivityNav } from "@/lib/activity/nav";
import { pendingReviews } from "@/lib/activity/api";

export function PendingReviewPrompt() {
  const { sessionToken } = useActivityAuth();
  const nav = useActivityNav();
  const [queue, setQueue] = useState<PendingReviewEvent[] | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // Captured once at mount: was this launch already a review deep-link?
  const [deepLinked] = useState(() => nav.view.name === "event-review");

  useEffect(() => {
    if (!sessionToken || deepLinked) return;
    let cancelled = false;
    pendingReviews(sessionToken)
      .then((events) => {
        if (!cancelled) setQueue(events.filter((e) => e.pending_count > 0));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionToken, deepLinked]);

  const total = useMemo(
    () => (queue ?? []).reduce((sum, e) => sum + e.pending_count, 0),
    [queue],
  );

  if (dismissed || deepLinked || !queue || queue.length === 0) return null;

  const openReview = (eventId: number) => {
    setDismissed(true);
    nav.push({ name: "event-review", id: eventId });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pending-review-title"
    >
      <div className="border-osrs-bronze/40 bg-osrs-surface-1 w-full max-w-sm rounded-2xl border p-4 shadow-2xl">
        <div className="mb-1 flex items-center gap-2">
          <span aria-hidden className="text-lg">
            🔍
          </span>
          <h2 id="pending-review-title" className="text-osrs-gold font-serif text-base font-bold">
            Awaiting your review
          </h2>
        </div>
        <p className="text-osrs-parchment-dark/70 text-[12.5px]">
          {total === 1
            ? "A task completion needs an admin's confirmation before it counts."
            : `${total} task completions need an admin's confirmation before they count.`}
        </p>

        <ul className="mt-3 space-y-1.5">
          {queue.slice(0, 3).map((e) => (
            <li key={e.event_id}>
              <button
                onClick={() => openReview(e.event_id)}
                className="border-osrs-bronze/25 bg-osrs-surface-2/60 hover:border-osrs-gold/60 flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors"
              >
                <span className="text-osrs-parchment min-w-0 flex-1 truncate text-[13px] font-semibold">
                  {e.event_name}
                </span>
                <span className="bg-osrs-red/80 text-osrs-parchment shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums">
                  {e.pending_count}
                </span>
              </button>
            </li>
          ))}
          {queue.length > 3 && (
            <li className="text-osrs-parchment-dark/50 px-1 text-[11.5px]">
              +{queue.length - 3} more event{queue.length - 3 === 1 ? "" : "s"} with pending items
            </li>
          )}
        </ul>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => openReview(queue[0]!.event_id)}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark flex-1 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-colors"
          >
            Review now
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="border-osrs-bronze/40 text-osrs-parchment-dark/70 hover:text-osrs-parchment rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
