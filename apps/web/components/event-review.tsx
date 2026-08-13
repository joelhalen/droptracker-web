"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EventCompletion, EventTask, EventTeam } from "@droptracker/api-types";
import { getErrorMessage } from "@/lib/errors";
import {
  completionMatchesFilter,
  restoreOptimisticRow,
  taskConfigItems,
  taskConfigPaths,
} from "@/lib/events";
import { Alert, EmptyState } from "@/components/ui";
import { LocalTime } from "@/components/local-time";
import {
  awardEventCompletion,
  confirmEventCompletion,
  confirmEventCompletionsBulk,
  listEventCompletions,
  rejectEventCompletion,
  revokeEventCompletion,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-2 text-sm outline-none";
const filterField =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold max-w-[14rem] rounded border px-2 py-1 text-xs outline-none";

const STATUS_FILTERS = ["pending", "all", "auto", "confirmed", "manual", "rejected", "revoked"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
/** Ledger rows an admin can still unwind. */
const REVOCABLE = new Set(["auto", "confirmed", "manual"]);

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
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [teamFilter, setTeamFilter] = useState(0);
  const [taskFilter, setTaskFilter] = useState(0);
  const [rows, setRows] = useState<EventCompletion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Per-row busy set, not one shared flag: reviewing a submission must never
  // disable the rest of the queue (a resubmitted drop is 2 rejects + 2
  // confirms, and each used to lock every button until its round trip landed).
  const [busy, setBusy] = useState<ReadonlySet<number>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  // Ledger reads are only issued on mount, filter changes and explicit
  // refreshes now, so an out-of-order response must not clobber newer state
  // (or the optimistic rows an in-flight action already removed).
  const reqRef = useRef(0);
  const reload = useCallback(
    // `keepMessage` lets a caller that already reported something (the bulk
    // confirm's skipped-rows summary) reconcile the list without wiping it.
    async ({ keepMessage = false }: { keepMessage?: boolean } = {}) => {
      const seq = ++reqRef.current;
      setLoading(true);
      try {
        const data = await listEventCompletions(groupId, eventId, {
          status: status === "all" ? undefined : status,
          teamId: teamFilter || undefined,
          taskId: taskFilter || undefined,
        });
        if (seq !== reqRef.current) return;
        if (!keepMessage) setError(null);
        setRows(data);
      } catch (err) {
        if (seq !== reqRef.current) return;
        setError(getErrorMessage(err, "Couldn't load the completion ledger."));
      } finally {
        if (seq === reqRef.current) setLoading(false);
      }
    },
    [groupId, eventId, status, teamFilter, taskFilter],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  /** The manual refresh that replaces the automatic post-action refetch: it
   * re-reads the ledger and re-renders the surrounding server page (task
   * progress, standings), which single reviews deliberately no longer do. */
  const onRefresh = () => {
    startTransition(async () => {
      await reload();
      router.refresh();
    });
  };

  /**
   * Optimistically move one row to `next`, then run the server action. Only
   * that row is disabled, so a reviewer can keep working straight down the
   * queue; a failure puts the row back exactly where it was and shows why.
   *
   * Server Actions themselves are dispatched through Next's router action
   * queue, which runs them one at a time — so the round trips still drain in
   * order (which also suits the backend, where each confirm is a full apply
   * that locks the row). What changed is that nothing waits on them: clicks
   * land immediately and the queue empties in the background.
   */
  const actOnRow = (
    row: EventCompletion,
    next: EventCompletion["status"],
    verb: string,
    run: () => Promise<unknown>,
  ) => {
    setError(null);
    setBusy((prev) => new Set(prev).add(row.id));
    const at = rows?.findIndex((r) => r.id === row.id) ?? -1;
    const optimistic: EventCompletion = { ...row, status: next };
    const stillListed = completionMatchesFilter(next, status);
    setRows((prev) =>
      prev === null
        ? prev
        : stillListed
          ? prev.map((r) => (r.id === row.id ? optimistic : r))
          : prev.filter((r) => r.id !== row.id),
    );
    startTransition(async () => {
      try {
        await run();
      } catch (err) {
        setError(`Couldn't ${verb} #${row.id} — ${getErrorMessage(err, "please try again.")}`);
        setRows((prev) => (prev === null ? prev : restoreOptimisticRow(prev, row, at)));
      } finally {
        setBusy((prev) => {
          const rest = new Set(prev);
          rest.delete(row.id);
          return rest;
        });
      }
    });
  };

  const onConfirm = (row: EventCompletion) =>
    actOnRow(row, "confirmed", "confirm", () => confirmEventCompletion(groupId, eventId, row.id));
  const onReject = (row: EventCompletion) =>
    actOnRow(row, "rejected", "reject", () => rejectEventCompletion(groupId, eventId, row.id));
  const onRevoke = (row: EventCompletion) =>
    actOnRow(row, "revoked", "revoke", () =>
      revokeEventCompletion(groupId, eventId, { completion_id: row.id }),
    );

  const onConfirmAll = () => {
    const ids = (rows ?? []).filter((r) => r.status === "pending").map((r) => r.id);
    if (!ids.length) return;
    setError(null);
    setBulkBusy(true);
    // Clear the queue up front; the single reconciling read below puts back
    // anything the server skipped.
    setRows((prev) =>
      prev === null
        ? prev
        : prev.flatMap((r) => {
            if (r.status !== "pending") return [r];
            const confirmed: EventCompletion = { ...r, status: "confirmed" };
            return completionMatchesFilter("confirmed", status) ? [confirmed] : [];
          }),
    );
    startTransition(async () => {
      try {
        // Server caps one call at 200 rows; larger queues go in chunks.
        const result = { confirmed: [] as number[], skipped: [] as { id: number; reason: string }[] };
        for (let i = 0; i < ids.length; i += 200) {
          const part = await confirmEventCompletionsBulk(groupId, eventId, ids.slice(i, i + 200));
          result.confirmed.push(...part.confirmed);
          result.skipped.push(...part.skipped);
        }
        if (result.skipped.length) {
          setError(
            `Confirmed ${result.confirmed.length} of ${ids.length}; skipped ` +
              result.skipped
                .slice(0, 3)
                .map((s) => `#${s.id} (${s.reason})`)
                .join(", ") +
              (result.skipped.length > 3 ? ` and ${result.skipped.length - 3} more.` : "."),
          );
        }
      } catch (err) {
        setError(getErrorMessage(err, "Batch confirm failed. The list below is re-read from the server."));
      } finally {
        // One reconciling read per batch — not one per row — and it must not
        // wipe the skipped-rows summary just reported above.
        await reload({ keepMessage: true });
        setBulkBusy(false);
      }
    });
  };

  // Manual award form (the escape hatch for pre-join credit and custom tasks).
  // Two modes: "complete" (server fills whatever progress remains — the
  // default; awarding quantity 1 against a 50-KC task completes nothing) and
  // "progress" (add an explicit quantity toward the goal). Multi-part tasks
  // (item lists / either-or paths) additionally take a part selection so the
  // award credits a specific item or KC/GP path instead of generic wildcard
  // progress; "complete" always fills the whole task, so the selector only
  // applies in progress mode. `part` encodes the choice: "item:<name>" or
  // "path:<idx>" ("" = whole task).
  const [award, setAward] = useState({
    taskId: 0,
    teamId: 0,
    mode: "complete" as "complete" | "progress",
    quantity: 1,
    part: "",
    note: "",
  });
  const partOptions = useMemo(() => {
    const task = tasks.find((t) => t.id === award.taskId);
    if (!task) return [];
    const opts: { value: string; label: string }[] = [];
    for (const [idx, p] of taskConfigPaths(task).entries()) {
      if (!p.metric) continue; // item/points paths are credited by item name
      const unit = p.metric === "kc" ? "KC" : "GP";
      const scope = p.npcs?.length ? ` — ${p.npcs.join(", ")}` : "";
      opts.push({
        value: `path:${idx}`,
        label: `Path: ${p.label ?? `${(p.need ?? 1).toLocaleString()} ${unit}`}${scope}`,
      });
    }
    for (const it of taskConfigItems(task)) {
      opts.push({
        value: `item:${it.item_name}`,
        label: it.points != null ? `${it.item_name} (${it.points} pts)` : it.item_name,
      });
    }
    return opts;
  }, [tasks, award.taskId]);
  const onAward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!award.taskId || !award.teamId) return;
    const part = award.mode === "progress" ? award.part : "";
    setError(null);
    setAwarding(true);
    startTransition(async () => {
      try {
        await awardEventCompletion(groupId, eventId, {
          task_id: award.taskId,
          team_id: award.teamId,
          complete: award.mode === "complete" || undefined,
          quantity: award.mode === "progress" ? award.quantity || 1 : undefined,
          matched_target: part.startsWith("item:") ? part.slice(5) : undefined,
          path: part.startsWith("path:") ? Number(part.slice(5)) : undefined,
          note: award.note.trim() || undefined,
        });
        setAward((a) => ({ ...a, note: "" }));
        // The awarded row is server-shaped (id, status, labels), so this one
        // reads it back rather than guessing at it.
        await reload();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't award that completion."));
      } finally {
        setAwarding(false);
      }
    });
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
        <span className="ml-auto flex items-center gap-3">
          {status === "pending" && (bulkBusy || pendingCount > 1) && (
            <button
              onClick={onConfirmAll}
              disabled={bulkBusy}
              className="text-osrs-gold-bright text-xs hover:underline disabled:opacity-50"
            >
              {bulkBusy ? "Confirming…" : `Confirm all (${pendingCount})`}
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Re-read the ledger and re-sync the rest of this page (task progress, standings)"
            className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-xs disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </span>
      </div>

      {(teams.length > 0 || tasks.length > 0) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {teams.length > 0 && (
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(Number(e.target.value))}
              title="Only show this team's rows"
              className={filterField}
            >
              <option value={0}>All teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {tasks.length > 0 && (
            <select
              value={taskFilter}
              onChange={(e) => setTaskFilter(Number(e.target.value))}
              title="Only show this task's rows"
              className={filterField}
            >
              <option value={0}>All tasks</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
          {(teamFilter > 0 || taskFilter > 0) && (
            <button
              onClick={() => {
                setTeamFilter(0);
                setTaskFilter(0);
              }}
              className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-xs"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {rows === null ? (
        <p className="text-osrs-parchment-dark/60 text-sm">Loading ledger…</p>
      ) : rows.length ? (
        <ul className={`divide-osrs-bronze/20 divide-y ${loading ? "opacity-60" : ""}`}>
          {rows.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
              {c.proof_url ? (
                <a href={c.proof_url} target="_blank" rel="noreferrer" className="shrink-0">
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
                  {c.matched_target && (
                    <span className="text-osrs-parchment-dark/70"> — {c.matched_target}</span>
                  )}
                  {c.quantity > 1 && <span className="text-osrs-parchment-dark/60"> ×{c.quantity}</span>}
                </span>
                <span className="text-osrs-parchment-dark/60 block truncate text-xs">
                  {c.team_name ?? "—"}
                  {c.player_name ? ` · ${c.player_name}` : ""} · <LocalTime unix={c.created_at} />
                  {c.note ? ` · “${c.note}”` : ""}
                </span>
              </span>
              <span className="text-osrs-parchment-dark/50 shrink-0 text-xs uppercase">{c.status}</span>
              {c.status === "pending" ? (
                <span className="flex shrink-0 gap-1">
                  <button
                    onClick={() => onConfirm(c)}
                    disabled={busy.has(c.id)}
                    className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-2 py-1 text-xs disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => onReject(c)}
                    disabled={busy.has(c.id)}
                    className="text-osrs-red hover:bg-osrs-red/10 rounded px-2 py-1 text-xs disabled:opacity-50"
                  >
                    Reject
                  </button>
                </span>
              ) : REVOCABLE.has(c.status) ? (
                <button
                  onClick={() => onRevoke(c)}
                  disabled={busy.has(c.id)}
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
            teamFilter > 0 || taskFilter > 0
              ? "Nothing matches the team/task filter — clear it to see the rest of the ledger."
              : status === "pending"
                ? "Completions that require confirmation will appear here."
                : "Try another status filter."
          }
        />
      )}

      <form onSubmit={onAward} className="mt-5 grid gap-2">
        <div className="grid gap-2 sm:grid-cols-[1fr_9rem_9rem_5rem_1fr_auto]">
        <select
          value={award.taskId}
          onChange={(e) => setAward((a) => ({ ...a, taskId: Number(e.target.value), part: "" }))}
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
        <select
          value={award.mode}
          onChange={(e) =>
            setAward((a) => ({ ...a, mode: e.target.value as "complete" | "progress" }))
          }
          title="Complete the task outright, or add a quantity toward its goal"
          className={field}
        >
          <option value="complete">Mark complete</option>
          <option value="progress">Add progress</option>
        </select>
        <input
          type="number"
          min={1}
          value={award.quantity}
          onChange={(e) => setAward((a) => ({ ...a, quantity: Math.max(1, Number(e.target.value)) }))}
          title="Quantity added toward the goal"
          disabled={award.mode === "complete"}
          className={`${field} disabled:opacity-40`}
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
          disabled={awarding || !award.taskId || !award.teamId}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {awarding ? "Awarding…" : "Award"}
        </button>
        </div>
        {partOptions.length > 0 && award.mode === "progress" && (
          <select
            value={award.part}
            onChange={(e) => setAward((a) => ({ ...a, part: e.target.value }))}
            title="Which part of the task this award credits"
            className={`${field} sm:max-w-md`}
          >
            <option value="">Whole task (no specific item/part)</option>
            {partOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        {partOptions.length > 0 && award.mode === "complete" && (
          <p className="text-osrs-parchment-dark/50 text-xs">
            To credit a specific item or path of this task, switch to “Add progress”.
          </p>
        )}
      </form>
    </section>
  );
}
