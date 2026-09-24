"use client";

import {
  completedNow,
  nothingMoved,
  receiptLines,
  type EventScoreChange,
} from "@/lib/event-credit-receipt";

/** "Before → after" card shown after a manual award or a confirm, so the
 * organizer can see the credit landed. */
export function EventCreditReceipt({
  title,
  change,
  onDismiss,
}: {
  title: string;
  change: EventScoreChange;
  onDismiss: () => void;
}) {
  const lines = receiptLines(change);
  if (!lines.length) return null;
  const stale = nothingMoved(change);
  return (
    <div
      role="status"
      className={`mb-3 rounded border px-3 py-2 text-sm ${
        stale ? "border-osrs-gold/50 bg-osrs-gold/5" : "border-osrs-green/40 bg-osrs-green/5"
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-osrs-parchment font-medium">
          {title}
          {completedNow(change) && <span className="text-osrs-green ml-2 text-xs">Task complete</span>}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-osrs-parchment-dark/60 hover:text-osrs-parchment text-xs"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      </div>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
        {lines.map((l) => (
          <div key={l.key} className="contents">
            <dt className="text-osrs-parchment-dark/70 truncate">
              {l.key === "task" ? "Progress" : l.key === "team" ? "Team" : "Player"}: {l.label}
            </dt>
            <dd className="text-right tabular-nums">
              <span className="text-osrs-parchment-dark/60">{l.before}</span>
              <span className="text-osrs-parchment-dark/40"> → </span>
              <span className="text-osrs-parchment">{l.after}</span>
              <span className={`ml-2 text-xs ${l.moved ? "text-osrs-green" : "text-osrs-parchment-dark/50"}`}>
                ({l.delta})
              </span>
            </dd>
          </div>
        ))}
      </dl>
      {stale && (
        <p className="text-osrs-gold mt-1 text-xs">
          The credit was recorded but none of these numbers changed. Check the task is not already
          complete, or that the amount was enough to count.
        </p>
      )}
    </div>
  );
}
