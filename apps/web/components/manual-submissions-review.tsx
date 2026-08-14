"use client";

import { useState, useTransition } from "react";
import type { ManualSubmissionQueue, ManualSubmissionRow } from "@droptracker/api-types";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Button, EmptyState } from "@/components/ui";
import {
  approveManualSubmission,
  rejectManualSubmission,
  undoManualSubmission,
} from "@/app/(site)/(admin)/groups/[id]/submissions/actions";

const relTime = (ts: number | null): string => {
  if (!ts) return "";
  const secs = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
};

function Row({
  row,
  actions,
}: {
  row: ManualSubmissionRow;
  actions?: React.ReactNode;
}) {
  return (
    <li className="border-osrs-bronze/20 flex flex-wrap items-center gap-3 rounded border px-3 py-2 text-sm">
      {row.image_url ? (
        <img
          src={row.image_url}
          alt=""
          className="border-osrs-bronze/40 h-12 w-12 shrink-0 rounded border object-cover"
        />
      ) : (
        <div className="border-osrs-bronze/30 text-osrs-parchment-dark/40 flex h-12 w-12 shrink-0 items-center justify-center rounded border text-[10px]">
          no img
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate">
          <span className="font-medium">{row.item_name ?? "Unknown item"}</span>
          {row.quantity > 1 && (
            <span className="text-osrs-parchment-dark/60"> ×{row.quantity}</span>
          )}
          {row.npc_name && (
            <span className="text-osrs-parchment-dark/60"> from {row.npc_name}</span>
          )}
        </div>
        <div className="text-osrs-parchment-dark/60 text-xs">
          {row.player_name ?? "Unknown"} · {row.value.value_formatted} gp
          {row.submitted_ts ? <> · {relTime(row.submitted_ts)}</> : null}
        </div>
      </div>
      {actions}
    </li>
  );
}

export function ManualSubmissionsReview({
  groupId,
  initial,
}: {
  groupId: number;
  initial: ManualSubmissionQueue;
}) {
  const [pending, setPending] = useState<ManualSubmissionRow[]>(initial.pending);
  const [recent, setRecent] = useState<ManualSubmissionRow[]>(initial.recent);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const act = (row: ManualSubmissionRow, approve: boolean) => {
    setError(null);
    setBusyId(row.drop_id);
    startTransition(async () => {
      try {
        if (approve) await approveManualSubmission(groupId, row.drop_id);
        else await rejectManualSubmission(groupId, row.drop_id);
        const reviewed: ManualSubmissionRow = {
          ...row,
          status: approve ? "approved" : "rejected",
          reviewed_ts: Math.floor(Date.now() / 1000),
        };
        setPending((prev) => prev.filter((r) => r.drop_id !== row.drop_id));
        setRecent((prev) => [reviewed, ...prev].slice(0, 25));
      } catch (err) {
        setError(getErrorMessage(err, approve ? "Couldn't approve." : "Couldn't reject."));
      } finally {
        setBusyId(null);
      }
    });
  };

  /** Put a reviewed row back in the queue — the decision, and an approval's
   * leaderboard credit and Discord announcement, are all reversed. */
  const undo = (row: ManualSubmissionRow) => {
    setError(null);
    setBusyId(row.drop_id);
    startTransition(async () => {
      try {
        await undoManualSubmission(groupId, row.drop_id);
        const requeued: ManualSubmissionRow = { ...row, status: "pending", reviewed_ts: null };
        setRecent((prev) => prev.filter((r) => r.drop_id !== row.drop_id));
        setPending((prev) => [requeued, ...prev]);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't undo that review."));
      } finally {
        setBusyId(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      <div>
        <h3 className="text-osrs-parchment mb-2 text-sm font-semibold">
          Awaiting review{pending.length ? ` (${pending.length})` : ""}
        </h3>
        {pending.length === 0 ? (
          <EmptyState
            title="Nothing to review"
            hint="Manual submissions held for approval will appear here."
          />
        ) : (
          <ul className="space-y-2">
            {pending.map((row) => (
              <Row
                key={row.drop_id}
                row={row}
                actions={
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => act(row, true)}
                      disabled={busyId === row.drop_id}
                    >
                      Approve
                    </Button>
                    <button
                      onClick={() => act(row, false)}
                      disabled={busyId === row.drop_id}
                      className="text-osrs-parchment-dark/70 hover:text-osrs-red rounded px-2 py-1 text-xs disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                }
              />
            ))}
          </ul>
        )}
      </div>

      {recent.length > 0 && (
        <div>
          <h3 className="text-osrs-parchment-dark/70 mb-2 text-sm font-semibold">Recently reviewed</h3>
          <ul className="space-y-2 opacity-80">
            {recent.map((row) => (
              <Row
                key={`r-${row.drop_id}`}
                row={row}
                actions={
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        row.status === "approved"
                          ? "bg-osrs-green/15 text-osrs-green"
                          : "bg-osrs-red/15 text-osrs-red"
                      }`}
                    >
                      {row.status}
                    </span>
                    <button
                      onClick={() => undo(row)}
                      disabled={busyId === row.drop_id}
                      title={
                        row.status === "approved"
                          ? "Put this back in the queue: the group's leaderboard credit is removed and the Discord announcement deleted."
                          : "Put this back in the queue."
                      }
                      className="text-osrs-parchment-dark/70 hover:text-osrs-gold rounded px-2 py-1 text-xs underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      Undo
                    </button>
                  </div>
                }
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
