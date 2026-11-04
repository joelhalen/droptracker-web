"use client";

/**
 * A server-rendered player board with an account-type filter on top. "All
 * players" is the SSR snapshot; picking a mode fetches that board once through
 * the BFF and keeps it for the visit. Ranks on a filtered board are positions
 * within the mode, as the backend assigns them.
 */
import { useState } from "react";
import { LeaderboardPageSchema, type LeaderboardEntry } from "@droptracker/api-types";
import { AccountTypeFilterBar } from "@/components/account-type-filter";
import { LeaderboardTable } from "@/components/leaderboard-table";

type Board = { status: "loading" | "ready" | "error"; entries: LeaderboardEntry[] };

export function FilterableLeaderboard({
  entries,
  scope,
  period,
  limit,
}: {
  entries: LeaderboardEntry[];
  scope: string;
  period: string;
  limit: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [boards, setBoards] = useState<Record<string, Board>>({});

  const select = (key: string | null) => {
    setActive(key);
    if (!key || boards[key]?.status === "ready" || boards[key]?.status === "loading") return;
    setBoards((b) => ({ ...b, [key]: { status: "loading", entries: b[key]?.entries ?? [] } }));
    const q = new URLSearchParams({ scope, period, limit: String(limit), account_type: key });
    fetch(`/api/leaderboards/players?${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json) => {
        const page = LeaderboardPageSchema.parse(json);
        setBoards((b) => ({ ...b, [key]: { status: "ready", entries: page.entries.slice(0, limit) } }));
      })
      .catch(() => setBoards((b) => ({ ...b, [key]: { status: "error", entries: [] } })));
  };

  const board = active ? boards[active] : null;
  const shown = board ? board.entries : entries;

  return (
    <div>
      <AccountTypeFilterBar active={active} onSelect={select} size="sm" className="mb-2" />
      {board?.status === "error" ? (
        <p className="text-osrs-parchment-dark/70 py-6 text-center text-sm">
          Couldn&apos;t load this board. Try again in a moment.
        </p>
      ) : board?.status === "loading" && shown.length === 0 ? (
        <p className="text-osrs-parchment-dark/60 py-6 text-center text-sm" aria-live="polite">
          Loading…
        </p>
      ) : (
        <div className={board?.status === "loading" ? "opacity-60 transition-opacity" : undefined}>
          <LeaderboardTable
            entries={shown}
            scope={scope}
            kind="players"
            emptyHint={active ? "No players of this account type are ranked here yet." : undefined}
          />
        </div>
      )}
    </div>
  );
}
