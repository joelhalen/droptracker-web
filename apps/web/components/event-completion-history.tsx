"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CompletionHistory, CompletionHistoryEntry, CompletionHistoryMode } from "@/lib/api";
import { METRIC_TASK_TYPES, contributionSummary, taskTypeLabel } from "@/lib/events";
import { formatRelativeTime } from "@/lib/format";

/** How much a row moved, read the way its task type means it — "1.20M gp",
 * "14 kills", "×24" — because a loot_value row's quantity is GP, and rendering
 * it as a bare "×1200000" next to an item name reads as nonsense. */
function amountLabel(e: CompletionHistoryEntry): string | null {
  if (!METRIC_TASK_TYPES.has(e.task_type ?? "")) {
    return e.quantity > 1 ? `×${e.quantity.toLocaleString()}` : null;
  }
  const summary = contributionSummary({
    task_id: e.task_id,
    task_type: e.task_type,
    quantity: e.quantity,
    source_type: e.source_type,
    // A collapsed run spans many items; the per-row name isn't representative.
    matched_target: null,
    created_at: e.created_at,
  });
  return summary === "credited" ? null : summary;
}

/** Public, read-only completion timeline for an event — the centralized
 * "where the points came from" view. Fetches through the same-origin BFF route
 * so pagination + filters work on the server-rendered event page; hidden
 * players are already masked to "Hidden player" for non-admin viewers by the
 * backend.
 *
 * Defaults to `mode=completions` (t54): the ledger holds one row per qualifying
 * submission, so a loot_value or kc task posts a row per drop/kill and the raw
 * feed is almost entirely progress ticks. The toggle brings them back, folded
 * into "advanced N times" runs by the backend. */
export function EventCompletionHistory({
  eventId,
  teams = [],
  taskTypes = [],
}: {
  eventId: number;
  teams?: Array<{ id: number; name: string }>;
  /** Task types present in this event, for the type chips. */
  taskTypes?: string[];
}) {
  const [data, setData] = useState<CompletionHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [team, setTeam] = useState<string>("");
  const [player, setPlayer] = useState("");
  const [playerCommitted, setPlayerCommitted] = useState("");
  const [mode, setMode] = useState<CompletionHistoryMode>("completions");
  const [taskType, setTaskType] = useState<string>("");

  const chips = useMemo(() => Array.from(new Set(taskTypes)), [taskTypes]);

  const load = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams();
        if (nextPage > 1) q.set("page", String(nextPage));
        if (team) q.set("teamId", team);
        if (playerCommitted.trim()) q.set("player", playerCommitted.trim());
        q.set("mode", mode);
        if (taskType) q.set("taskType", taskType);
        const res = await fetch(`/api/events/${eventId}/completions/history?${q}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const json = (await res.json()) as CompletionHistory;
        setData(json);
        setPage(nextPage);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [eventId, team, playerCommitted, mode, taskType],
  );

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, team, playerCommitted, mode, taskType]);

  const meta = data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / Math.max(1, meta.limit))) : 1;
  // Counted by the backend before `mode` narrowed, so it stays honest about
  // what the toggle would reveal even on page 3 of a filtered view.
  const hiddenProgress = mode === "completions" ? (meta?.progress_total ?? 0) : 0;

  const field =
    "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-2 text-sm outline-none";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        {teams.length > 1 && (
          <label className="block">
            <span className="text-osrs-parchment-dark/60 mb-1 block text-xs">Team</span>
            <select value={team} onChange={(e) => setTeam(e.target.value)} className={field}>
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="text-osrs-parchment-dark/60 mb-1 block text-xs">Player</span>
          <input
            value={player}
            onChange={(e) => setPlayer(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setPlayerCommitted(player)}
            onBlur={() => setPlayerCommitted(player)}
            placeholder="search RSN…"
            className={`${field} w-44`}
          />
        </label>
        <label className="border-osrs-bronze/40 hover:bg-osrs-bronze/10 flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={mode === "all"}
            onChange={(e) => setMode(e.target.checked ? "all" : "completions")}
            className="accent-osrs-gold"
          />
          <span>
            Show progress updates
            {hiddenProgress > 0 && (
              <span className="text-osrs-parchment-dark/50 ml-1 text-xs tabular-nums">
                ({hiddenProgress.toLocaleString()} hidden)
              </span>
            )}
          </span>
        </label>
      </div>

      {chips.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {["", ...chips].map((t) => (
            <button
              key={t || "all"}
              onClick={() => setTaskType(t)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                taskType === t
                  ? "border-osrs-gold bg-osrs-gold/15 text-osrs-gold"
                  : "border-osrs-bronze/40 text-osrs-parchment-dark/70 hover:bg-osrs-bronze/15"
              }`}
            >
              {t ? taskTypeLabel(t) : "All types"}
            </button>
          ))}
        </div>
      )}

      {error && <div className="text-osrs-red text-sm">{error}</div>}

      {loading && !data ? (
        <div className="text-osrs-parchment-dark/60 p-6 text-center text-sm">Loading…</div>
      ) : data && data.entries.length === 0 ? (
        <div className="border-osrs-bronze/20 text-osrs-parchment-dark/60 space-y-3 rounded border p-6 text-center text-sm">
          <p>
            {hiddenProgress > 0
              ? "Nothing has been completed yet — but progress is being made."
              : "No completions recorded yet."}
          </p>
          {hiddenProgress > 0 && (
            <button
              onClick={() => setMode("all")}
              className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1"
            >
              Show {hiddenProgress.toLocaleString()} progress update
              {hiddenProgress === 1 ? "" : "s"}
            </button>
          )}
        </div>
      ) : (
        <div className="border-osrs-bronze/20 overflow-x-auto rounded border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-osrs-brown-dark/60 text-osrs-parchment-dark/70">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">
                  {mode === "completions" ? "Completed" : "Activity"}
                </th>
                <th className="px-3 py-2 font-medium">Player</th>
                {teams.length > 1 && <th className="px-3 py-2 font-medium">Team</th>}
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Points</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Proof</th>
              </tr>
            </thead>
            <tbody className="divide-osrs-bronze/15 divide-y">
              {data?.entries.map((e) => (
                <tr key={e.completion_id} className="hover:bg-osrs-bronze/5">
                  <td className="text-osrs-parchment-dark/70 whitespace-nowrap px-3 py-2 tabular-nums">
                    {formatRelativeTime(e.created_at ?? 0)}
                    {!!e.collapsed && e.collapsed > 1 && e.collapsed_since != null && (
                      <span className="text-osrs-parchment-dark/40 block text-xs">
                        since {formatRelativeTime(e.collapsed_since)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-osrs-parchment">
                      {e.matched_target || e.task_label || "—"}
                    </span>
                    {amountLabel(e) && (
                      <span className="text-osrs-parchment-dark/50 ml-1 text-xs">
                        {amountLabel(e)}
                      </span>
                    )}
                    {e.matched_target && e.task_label && e.matched_target !== e.task_label && (
                      <span className="text-osrs-parchment-dark/40 ml-2 text-xs">{e.task_label}</span>
                    )}
                    {!!e.collapsed && e.collapsed > 1 && (
                      <span className="border-osrs-bronze/40 text-osrs-parchment-dark/60 ml-2 rounded-full border px-2 py-0.5 text-xs">
                        advanced {e.collapsed.toLocaleString()} times
                      </span>
                    )}
                    {e.note && (
                      <span className="text-osrs-parchment-dark/50 block text-xs italic">
                        “{e.note}”
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        e.hidden || (!e.player_name && e.source_type === "manual")
                          ? "text-osrs-parchment-dark/50 italic"
                          : ""
                      }
                    >
                      {e.player_name ?? (e.source_type === "manual" ? "Manual award" : "—")}
                    </span>
                  </td>
                  {teams.length > 1 && (
                    <td className="text-osrs-parchment-dark/80 px-3 py-2">{e.team_name ?? "—"}</td>
                  )}
                  <td className="text-osrs-gold px-3 py-2 text-right tabular-nums">
                    {e.points ? e.points.toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {e.proof_url ? (
                      <a
                        href={e.proof_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-osrs-gold hover:underline"
                      >
                        view
                      </a>
                    ) : (
                      <span className="text-osrs-parchment-dark/30">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && data && data.entries.length > 0 && (
        <div className="text-osrs-parchment-dark/60 flex items-center justify-between text-sm">
          <span>
            Page {meta.page} of {totalPages} · {meta.total} total
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => load(page - 1)}
              className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => load(page + 1)}
              className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
