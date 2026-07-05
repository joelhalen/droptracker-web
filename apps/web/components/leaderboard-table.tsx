"use client";

/**
 * Live leaderboard table. First paint comes from the Server Component
 * (SSR/ISR snapshot); on hydration we subscribe to the SSE stream for the given
 * scope and apply `leaderboard_delta` events to the rows in place
 * (FRONTEND_PLAN.md §8.4).
 */
import { useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import type { LeaderboardEntry } from "@droptracker/api-types";
import { useEventStream } from "@/lib/use-event-stream";
import { formatGp } from "@/lib/format";
import { EmptyState, EntityChip, RankMedal } from "@/components/ui";
import { PlayerBadgeIcons } from "@/components/player-badges";

const BADGE_DURATION_MS = 2500;

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

  // Re-sync when the server sends a fresh snapshot (period/page/tab change).
  // Without this, useState would keep the initial page's rows on navigation.
  useEffect(() => {
    setRows(entries);
  }, [entries]);

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
      // Clear the delta once its badge has faded so a stale "+X" doesn't
      // linger on the row until the next update.
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, delta: undefined } : r)),
      );
    }, BADGE_DURATION_MS);
  });

  const hrefBase = kind === "players" ? "/players" : "/groups";
  const maxLoot = rows.reduce((max, r) => Math.max(max, r.loot.value), 0);
  const liveLabel = useMemo(
    () =>
      state === "open"
        ? "● live"
        : state === "connecting"
          ? "○ connecting"
          : "○ offline",
    [state],
  );

  if (!rows.length) {
    return (
      <EmptyState
        title={
          kind === "players" ? "No ranked players yet" : "No ranked clans yet"
        }
        hint="Leaderboards populate as drops are tracked for this period."
      />
    );
  }

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
      <div className="border-osrs-bronze/20 overflow-x-auto rounded border">
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
                <td className="px-3 py-2">
                  <RankMedal rank={r.rank} />
                </td>
                <td className="px-3 py-2">
                  <EntityChip
                    href={`${hrefBase}/${r.id}` as Route}
                    name={r.name}
                    size="sm"
                    badges={
                      r.badges?.length ? <PlayerBadgeIcons badges={r.badges} /> : undefined
                    }
                  />
                </td>
                {/* Relative loot bar behind the value: instant read of the
                    gap between ranks without scanning the numbers. */}
                <td className="relative px-3 py-2 text-right tabular-nums">
                  {maxLoot > 0 && r.loot.value > 0 && (
                    <span
                      aria-hidden
                      className="bg-osrs-gold/10 absolute inset-y-1.5 right-0 rounded-l"
                      style={{ width: `${Math.max(2, (r.loot.value / maxLoot) * 100)}%` }}
                    />
                  )}
                  <span className="relative inline-block">
                    {r.loot.value_formatted}
                    {r.delta != null && r.delta > 0 && (
                      <span className="text-osrs-green animate-fade-up absolute -top-4 right-0 text-xs font-semibold whitespace-nowrap">
                        +{formatGp(r.delta)}
                      </span>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
