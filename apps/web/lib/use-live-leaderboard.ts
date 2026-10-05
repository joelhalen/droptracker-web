"use client";

/**
 * A loot leaderboard's rows, kept live from the SSE stream: each
 * `leaderboard_delta` adds to the matching player's total and flashes the row.
 * Shared by the site's `LeaderboardTable` and the Discord Activity's ranks
 * view; the stream endpoint comes from context, so both are authorised.
 *
 * Deltas are player deltas only (see `lib/live-leaderboard.ts`), so a groups
 * board passes `kind: "groups"` and is never patched (it still re-syncs when
 * new entries arrive).
 */
import { useEffect, useRef, useState } from "react";
import type { LeaderboardEntry } from "@droptracker/api-types";
import { useEventStream, type ConnectionState } from "@/lib/use-event-stream";
import {
  applyLeaderboardDelta,
  clearLeaderboardDelta,
  parseLeaderboardDelta,
} from "@/lib/live-leaderboard";

const BADGE_DURATION_MS = 2500;

export function useLiveLeaderboard(
  entries: LeaderboardEntry[],
  /** SSE scope: `global` or `group:{id}`. Empty disables the stream. */
  scope: string | null,
  kind: "players" | "groups",
): { rows: LeaderboardEntry[]; flashing: Set<number>; state: ConnectionState } {
  const [rows, setRows] = useState(entries);
  const [flashing, setFlashing] = useState<Set<number>>(new Set());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  // Re-sync when a fresh snapshot arrives (period/page/tab change); without
  // this the first page's rows would stick.
  useEffect(() => {
    setRows(entries);
  }, [entries]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending) clearTimeout(t);
      pending.clear();
    };
  }, []);

  const { state } = useEventStream(scope && kind === "players" ? [scope] : [], (event) => {
    const d = parseLeaderboardDelta(event.type, event.data);
    if (!d) return;
    setRows((prev) => applyLeaderboardDelta(prev, d));
    setFlashing((prev) => new Set(prev).add(d.id));
    const t = setTimeout(() => {
      timers.current.delete(t);
      setFlashing((prev) => {
        const next = new Set(prev);
        next.delete(d.id);
        return next;
      });
      // Clear the delta once its badge has faded so a stale "+X" doesn't
      // linger on the row until the next update.
      setRows((prev) => clearLeaderboardDelta(prev, d.id));
    }, BADGE_DURATION_MS);
    timers.current.add(t);
  });

  return { rows, flashing, state };
}
