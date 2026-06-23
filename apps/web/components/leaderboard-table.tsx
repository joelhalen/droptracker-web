"use client";

/**
 * Live leaderboard table. First paint comes from the Server Component
 * (SSR/ISR snapshot); on hydration we subscribe to the SSE stream for the given
 * scope and apply `leaderboard_delta` events to the rows in place
 * (FRONTEND_PLAN.md §8.4).
 */
import { useMemo, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import type { LeaderboardEntry } from "@droptracker/api-types";
import { useEventStream } from "@/lib/use-event-stream";

type Props = {
  entries: LeaderboardEntry[];
  scope: string;
  /** "players" | "groups" — controls the profile link target. */
  kind: "players" | "groups";
};

export function LeaderboardTable({ entries, scope, kind }: Props) {
  const [rows, setRows] = useState(entries);
  // Track ids that just changed so we can flash them.
  const [flashing, setFlashing] = useState<Set<number>>(new Set());

  const { state } = useEventStream([scope], (event) => {
    if (event.type !== "leaderboard_delta") return;
    const id = Number(event.data.id);
    const delta = Number(event.data.delta ?? 0);
    if (!Number.isFinite(id)) return;

    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, loot: { ...r.loot, value: r.loot.value + delta }, delta }
          : r,
      ),
    );
    setFlashing((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setFlashing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 1200);
  });

  const hrefBase = kind === "players" ? "/players" : "/groups";
  const liveLabel = useMemo(
    () => (state === "open" ? "● live" : state === "connecting" ? "○ connecting" : "○ offline"),
    [state],
  );

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <span
          className={`text-xs ${state === "open" ? "text-osrs-green" : "text-osrs-parchment-dark/60"}`}
          aria-live="polite"
        >
          {liveLabel}
        </span>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-osrs-gold/80 text-left">
            <th className="w-12 px-3 py-2">#</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2 text-right">Loot</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className={`border-osrs-bronze/20 border-t transition-colors ${
                flashing.has(r.id) ? "bg-osrs-gold/15" : ""
              }`}
            >
              <td className="text-osrs-parchment-dark px-3 py-2 tabular-nums">{r.rank}</td>
              <td className="px-3 py-2">
                <Link href={`${hrefBase}/${r.id}` as Route} className="hover:text-osrs-gold-bright">
                  {r.name}
                </Link>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{r.loot.value_formatted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
