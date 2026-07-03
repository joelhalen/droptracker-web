"use client";

import { useEffect, useState, useTransition } from "react";
import type { Route } from "next";
import Link from "next/link";
import type { GroupMember, WomSyncResult } from "@droptracker/api-types";
import { setHidden, syncWom } from "@/app/(admin)/groups/[id]/members/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Badge, EmptyState, EntityChip } from "@/components/ui";

export function MembersManager({
  groupId,
  members,
  total,
  page = 1,
  limit = 25,
}: {
  groupId: number;
  members: GroupMember[];
  total: number;
  page?: number;
  limit?: number;
}) {
  const [rows, setRows] = useState(members);
  const [pending, startTransition] = useTransition();
  const [sync, setSync] = useState<WomSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep local rows in sync when the server sends a new page.
  useEffect(() => {
    setRows(members);
  }, [members]);

  const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

  const onSync = () =>
    startTransition(async () => {
      setError(null);
      try {
        setSync(await syncWom(groupId));
      } catch (err) {
        setError(getErrorMessage(err, "WOM sync failed. Please try again."));
      }
    });

  const onToggle = (playerId: number, hidden: boolean) => {
    // Optimistic update with revert on failure.
    setRows((prev) => prev.map((m) => (m.id === playerId ? { ...m, hidden } : m)));
    setError(null);
    startTransition(async () => {
      try {
        await setHidden(groupId, playerId, hidden);
      } catch (err) {
        setRows((prev) => prev.map((m) => (m.id === playerId ? { ...m, hidden: !hidden } : m)));
        setError(getErrorMessage(err, "Couldn't update visibility. Please try again."));
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-osrs-parchment-dark/70 text-sm">
          {total} member{total === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-3">
          {sync && (
            <span className="text-osrs-green text-xs">
              Synced: +{sync.added} / −{sync.removed} ({sync.total} total)
            </span>
          )}
          <button
            onClick={onSync}
            disabled={pending}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Working…" : "Sync from WOM"}
          </button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-osrs-gold/80 text-left">
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2 text-right">Loot</th>
                <th className="px-3 py-2 text-right">Visibility</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr
                  key={m.id}
                  className={`border-osrs-bronze/20 border-t ${m.hidden ? "opacity-60" : ""}`}
                >
                  <td className="px-3 py-2">
                    <EntityChip href={`/players/${m.id}`} name={m.name} size="sm" />
                  </td>
                  <td className="px-3 py-2">
                    {m.group_rank ? (
                      <Badge tone="bronze">{m.group_rank}</Badge>
                    ) : (
                      <span className="text-osrs-parchment-dark/50">—</span>
                    )}
                  </td>
                  <td className="text-osrs-gold-bright px-3 py-2 text-right tabular-nums">
                    {m.total_loot?.value_formatted ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => onToggle(m.id, !m.hidden)}
                      disabled={pending}
                      aria-pressed={m.hidden}
                      className={`rounded px-2 py-1 text-xs ${
                        m.hidden
                          ? "bg-osrs-red/20 text-osrs-red"
                          : "bg-osrs-green/20 text-osrs-green"
                      } disabled:opacity-50`}
                    >
                      {m.hidden ? "Hidden" : "Visible"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No members yet"
          hint="Run a WOM sync to pull in your clan's members."
        />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-sm">
          {page > 1 ? (
            <Link
              href={`/groups/${groupId}/members?page=${page - 1}` as Route}
              className="hover:text-osrs-gold-bright"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-osrs-parchment-dark/70">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/groups/${groupId}/members?page=${page + 1}` as Route}
              className="hover:text-osrs-gold-bright"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
