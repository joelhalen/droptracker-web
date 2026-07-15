"use client";

/**
 * The Activity's review screen for one event: the pending-completions queue,
 * thumb-first. This is the deep-link target of the "Review in app" button on
 * event_pending Discord messages and of the boot-time pop-up. Confirm/reject
 * hit the same Web API routes as the site's review queue (admin auth, the
 * pending-only guard and audit logging all live upstream).
 */
import { useCallback, useEffect, useState } from "react";
import type { EventCompletion } from "@droptracker/api-types";
import { formatRelativeTime } from "@/lib/format";
import { useActivityAuth } from "@/lib/activity/auth-context";
import { useActivityNav } from "@/lib/activity/nav";
import {
  ActivityApiError,
  confirmCompletion,
  eventDetail,
  eventPendingCompletions,
  rejectCompletion,
} from "@/lib/activity/api";
import { BackBar, EmptyNote, ErrorNote, LoadingBlock } from "@/components/activity/bits";

export function EventReviewView({ eventId }: { eventId: number }) {
  const nav = useActivityNav();
  const { sessionToken } = useActivityAuth();
  const [eventName, setEventName] = useState<string | null>(null);
  const [rows, setRows] = useState<EventCompletion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Completion ids with an action in flight (per-row button lockout). */
  const [busy, setBusy] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    if (!sessionToken) return;
    try {
      setRows(await eventPendingCompletions(eventId, sessionToken));
      setError(null);
    } catch (err) {
      setError(
        err instanceof ActivityApiError && err.status === 403
          ? "Only this event's admins can review completions."
          : "Couldn't load the review queue.",
      );
    }
  }, [eventId, sessionToken]);

  useEffect(() => {
    void load();
  }, [load]);

  // Event name for the header — best-effort, the queue renders without it.
  useEffect(() => {
    let cancelled = false;
    eventDetail(eventId, sessionToken)
      .then((ev) => {
        if (!cancelled) setEventName(ev.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventId, sessionToken]);

  const act = async (completionId: number, action: "confirm" | "reject") => {
    if (!sessionToken) return;
    setBusy((b) => new Set(b).add(completionId));
    try {
      if (action === "confirm") await confirmCompletion(eventId, completionId, sessionToken);
      else await rejectCompletion(eventId, completionId, sessionToken);
      // Drop the row locally, then re-sync (another admin may be working too).
      setRows((r) => (r ? r.filter((c) => c.id !== completionId) : r));
      void load();
    } catch (err) {
      setError(err instanceof ActivityApiError ? err.message : "Action failed. Try again.");
      void load();
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(completionId);
        return next;
      });
    }
  };

  const onBack = () => {
    if (nav.canPop) nav.pop();
    else nav.setRoot({ name: "event", id: eventId });
  };

  return (
    <div>
      <BackBar title={eventName ? `Review — ${eventName}` : "Review queue"} onBack={onBack} />

      {!sessionToken ? (
        <ErrorNote>
          Approve the Discord sign-in prompt when launching the activity to review completions.
        </ErrorNote>
      ) : error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : rows === null ? (
        <LoadingBlock rows={4} />
      ) : rows.length === 0 ? (
        <EmptyNote>
          Nothing awaiting review — completions that need confirmation will appear here.
        </EmptyNote>
      ) : (
        <>
          <p className="text-osrs-parchment-dark/60 mb-2 text-[12px]">
            {rows.length} completion{rows.length === 1 ? "" : "s"} awaiting confirmation
          </p>
          <ul className="border-osrs-bronze/25 bg-osrs-surface-1/60 divide-osrs-bronze/20 divide-y overflow-hidden rounded-2xl border">
            {rows.map((c) => {
              const rowBusy = busy.has(c.id);
              return (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                  {c.proof_url ? (
                    <img
                      src={c.proof_url}
                      alt="Proof screenshot"
                      className="border-osrs-bronze/30 size-11 shrink-0 rounded-lg border object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="border-osrs-bronze/20 text-osrs-parchment-dark/40 flex size-11 shrink-0 items-center justify-center rounded-lg border text-[9px]"
                    >
                      no img
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="text-osrs-parchment block truncate text-[13px] font-semibold">
                      {c.task_label ?? `Task #${c.task_id}`}
                      {c.quantity > 1 && (
                        <span className="text-osrs-gold/80"> ×{c.quantity.toLocaleString()}</span>
                      )}
                    </span>
                    <span className="text-osrs-parchment-dark/55 block truncate text-[11.5px]">
                      {c.team_name ?? "—"}
                      {c.player_name ? ` · ${c.player_name}` : ""} ·{" "}
                      {formatRelativeTime(c.created_at)}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => void act(c.id, "confirm")}
                      disabled={rowBusy}
                      className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => void act(c.id, "reject")}
                      disabled={rowBusy}
                      className="text-osrs-red hover:bg-osrs-red/10 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-osrs-parchment-dark/45 mt-3 text-[11px]">
            Confirming applies points and progress exactly like an automatic completion. The full
            ledger (and manual awards) lives in the event manager on droptracker.io.
          </p>
        </>
      )}
    </div>
  );
}
