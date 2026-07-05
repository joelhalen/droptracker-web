"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { EventCompletion, EventTask, EventTeam } from "@droptracker/api-types";
import { getErrorMessage } from "@/lib/errors";
import { Alert, EmptyState } from "@/components/ui";
import {
  awardEventCompletion,
  confirmEventCompletion,
  listEventCompletions,
  rejectEventCompletion,
  revokeEventCompletion,
} from "@/app/(admin)/groups/[id]/events/actions";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-2 text-sm outline-none";

const STATUS_FILTERS = ["pending", "all", "auto", "confirmed", "manual", "rejected", "revoked"] as const;
/** Ledger rows an admin can still unwind. */
const REVOCABLE = new Set(["auto", "confirmed", "manual"]);

const when = (ts: number) => new Date(ts * 1000).toLocaleString();

/** Verification queue + completion ledger + manual award (Task 18, PRD D3/D10). */
export function EventReview({
  groupId,
  eventId,
  tasks,
  teams,
}: {
  groupId: number | null;
  eventId: number;
  tasks: EventTask[];
  teams: EventTeam[];
}) {
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("pending");
  const [rows, setRows] = useState<EventCompletion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reload = useCallback(
    (nextStatus = status) => {
      startTransition(async () => {
        try {
          setError(null);
          const data = await listEventCompletions(groupId, eventId, {
            status: nextStatus === "all" ? undefined : nextStatus,
          });
          setRows(data);
        } catch (err) {
          setError(getErrorMessage(err, "Couldn't load the completion ledger."));
        }
      });
    },
    [groupId, eventId, status],
  );

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const act = (fn: () => Promise<unknown>) => {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        reload();
      } catch (err) {
        setError(getErrorMessage(err, "Action failed. Please try again."));
      }
    });
  };

  const onConfirm = (id: number) => act(() => confirmEventCompletion(groupId, eventId, id));
  const onReject = (id: number) => act(() => rejectEventCompletion(groupId, eventId, id));
  const onRevoke = (id: number) => act(() => revokeEventCompletion(groupId, eventId, { completion_id: id }));
  const onConfirmAll = () => {
    const ids = (rows ?? []).filter((r) => r.status === "pending").map((r) => r.id);
    if (!ids.length) return;
    setError(null);
    startTransition(async () => {
      try {
        for (const id of ids) await confirmEventCompletion(groupId, eventId, id);
        reload();
      } catch (err) {
        setError(getErrorMessage(err, "Batch confirm stopped early. Reload to see progress."));
        reload();
      }
    });
  };

  // Manual award form (the escape hatch for pre-join credit and custom tasks).
  const [award, setAward] = useState({ taskId: 0, teamId: 0, quantity: 1, note: "" });
  const onAward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!award.taskId || !award.teamId) return;
    act(() =>
      awardEventCompletion(groupId, eventId, {
        task_id: award.taskId,
        team_id: award.teamId,
        quantity: award.quantity || 1,
        note: award.note.trim() || undefined,
      }),
    );
    setAward((a) => ({ ...a, note: "" }));
  };

  const pendingCount = (rows ?? []).filter((r) => r.status === "pending").length;

  return (
    <section>
      <h3 className="heading-rule text-osrs-gold mb-4 flex items-center gap-2 pb-1 text-lg font-semibold">
        Review
        {status === "pending" && pendingCount > 0 && (
          <span className="bg-osrs-red/80 text-osrs-parchment rounded-full px-2 py-0.5 text-xs font-bold">
            {pendingCount}
          </span>
        )}
      </h3>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded px-2.5 py-1 text-xs capitalize ${
              status === s
                ? "bg-osrs-bronze text-osrs-parchment"
                : "text-osrs-parchment-dark/60 hover:text-osrs-gold-bright"
            }`}
          >
            {s}
          </button>
        ))}
        {status === "pending" && pendingCount > 1 && (
          <button
            onClick={onConfirmAll}
            disabled={pending}
            className="text-osrs-gold-bright ml-auto text-xs hover:underline disabled:opacity-50"
          >
            Confirm all ({pendingCount})
          </button>
        )}
      </div>

      {rows === null ? (
        <p className="text-osrs-parchment-dark/60 text-sm">Loading ledger…</p>
      ) : rows.length ? (
        <ul className="divide-osrs-bronze/20 divide-y">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
              {c.proof_url ? (
                <a href={c.proof_url} target="_blank" rel="noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.proof_url}
                    alt="proof"
                    className="border-osrs-bronze/30 size-10 rounded border object-cover"
                  />
                </a>
              ) : (
                <span className="border-osrs-bronze/20 text-osrs-parchment-dark/40 flex size-10 shrink-0 items-center justify-center rounded border text-[10px]">
                  no img
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  {c.task_label ?? `Task #${c.task_id}`}
                  {c.quantity > 1 && <span className="text-osrs-parchment-dark/60"> ×{c.quantity}</span>}
                </span>
                <span className="text-osrs-parchment-dark/60 block truncate text-xs">
                  {c.team_name ?? "—"}
                  {c.player_name ? ` · ${c.player_name}` : ""} · {when(c.created_at)}
                  {c.note ? ` · “${c.note}”` : ""}
                </span>
              </span>
              <span className="text-osrs-parchment-dark/50 shrink-0 text-xs uppercase">{c.status}</span>
              {c.status === "pending" ? (
                <span className="flex shrink-0 gap-1">
                  <button
                    onClick={() => onConfirm(c.id)}
                    disabled={pending}
                    className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-2 py-1 text-xs disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => onReject(c.id)}
                    disabled={pending}
                    className="text-osrs-red hover:bg-osrs-red/10 rounded px-2 py-1 text-xs disabled:opacity-50"
                  >
                    Reject
                  </button>
                </span>
              ) : REVOCABLE.has(c.status) ? (
                <button
                  onClick={() => onRevoke(c.id)}
                  disabled={pending}
                  className="text-osrs-red hover:bg-osrs-red/10 shrink-0 rounded px-2 py-1 text-xs disabled:opacity-50"
                >
                  Revoke
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={status === "pending" ? "Nothing awaiting review" : "No ledger entries"}
          hint={
            status === "pending"
              ? "Completions that require confirmation will appear here."
              : "Try another status filter."
          }
        />
      )}

      <form onSubmit={onAward} className="mt-5 grid gap-2 sm:grid-cols-[1fr_10rem_5rem_1fr_auto]">
        <select
          value={award.taskId}
          onChange={(e) => setAward((a) => ({ ...a, taskId: Number(e.target.value) }))}
          className={field}
        >
          <option value={0}>Manual award: task…</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={award.teamId}
          onChange={(e) => setAward((a) => ({ ...a, teamId: Number(e.target.value) }))}
          className={field}
        >
          <option value={0}>Team…</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          value={award.quantity}
          onChange={(e) => setAward((a) => ({ ...a, quantity: Math.max(1, Number(e.target.value)) }))}
          title="Quantity"
          className={field}
        />
        <input
          value={award.note}
          onChange={(e) => setAward((a) => ({ ...a, note: e.target.value }))}
          placeholder="Note (why it's awarded manually)"
          maxLength={255}
          className={field}
        />
        <button
          type="submit"
          disabled={pending || !award.taskId || !award.teamId}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          Award
        </button>
      </form>
    </section>
  );
}
