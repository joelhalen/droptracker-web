"use client";

import { useCallback, useEffect, useState } from "react";
import type { CompletionHistory } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";

/** Public, read-only completion timeline for an event — the centralized
 * "where the points came from" view. Fetches through the same-origin BFF route
 * so pagination + filters work on the server-rendered event page; hidden
 * players are already masked to "Hidden player" for non-admin viewers by the
 * backend. */
export function EventCompletionHistory({
  eventId,
  teams = [],
}: {
  eventId: number;
  teams?: Array<{ id: number; name: string }>;
}) {
  const [data, setData] = useState<CompletionHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [team, setTeam] = useState<string>("");
  const [player, setPlayer] = useState("");
  const [playerCommitted, setPlayerCommitted] = useState("");

  const load = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams();
        if (nextPage > 1) q.set("page", String(nextPage));
        if (team) q.set("teamId", team);
        if (playerCommitted.trim()) q.set("player", playerCommitted.trim());
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
    [eventId, team, playerCommitted],
  );

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, team, playerCommitted]);

  const meta = data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / Math.max(1, meta.limit))) : 1;

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
      </div>

      {error && <div className="text-osrs-red text-sm">{error}</div>}

      {loading && !data ? (
        <div className="text-osrs-parchment-dark/60 p-6 text-center text-sm">Loading…</div>
      ) : data && data.entries.length === 0 ? (
        <div className="border-osrs-bronze/20 text-osrs-parchment-dark/60 rounded border p-6 text-center text-sm">
          No completions recorded yet.
        </div>
      ) : (
        <div className="border-osrs-bronze/20 overflow-x-auto rounded border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-osrs-brown-dark/60 text-osrs-parchment-dark/70">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Completed</th>
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
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-osrs-parchment">
                      {e.matched_target || e.task_label || "—"}
                    </span>
                    {e.quantity > 1 && (
                      <span className="text-osrs-parchment-dark/50 ml-1 text-xs">×{e.quantity}</span>
                    )}
                    {e.matched_target && e.task_label && e.matched_target !== e.task_label && (
                      <span className="text-osrs-parchment-dark/40 ml-2 text-xs">{e.task_label}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={e.hidden ? "text-osrs-parchment-dark/50 italic" : ""}>
                      {e.player_name ?? "—"}
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
