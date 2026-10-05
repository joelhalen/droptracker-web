"use client";

/**
 * Live leaderboard table. First paint comes from the Server Component
 * (SSR/ISR snapshot); on hydration we subscribe to the SSE stream for the given
 * scope and apply `leaderboard_delta` events to the rows in place
 * (FRONTEND_PLAN.md §8.4) through `useLiveLeaderboard`, which the Discord
 * Activity's ranks view shares. Deltas are player-only, so a groups board
 * stays a snapshot.
 */
import { useMemo } from "react";
import type { LeaderboardEntry } from "@droptracker/api-types";
import { entityPath } from "@/lib/slug";
import { useLiveLeaderboard } from "@/lib/use-live-leaderboard";
import { formatGp } from "@/lib/format";
import { EmptyState, EntityChip, RankMedal } from "@/components/ui";
import { PlayerBadgeIcons } from "@/components/player-badges";
import { EntityHoverCard } from "@/components/entity-hover-card";

type Props = {
  entries: LeaderboardEntry[];
  scope: string;
  /** "players" | "groups" — controls the profile link target. */
  kind: "players" | "groups";
};

export function LeaderboardTable({ entries, scope, kind }: Props) {
  const { rows, flashing, state } = useLiveLeaderboard(entries, scope, kind);

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
      {/* Only player boards move live; a clan board is the snapshot. */}
      {kind === "players" && (
        <div className="mb-2 flex justify-end">
          <span
            className={`text-xs ${state === "open" ? "text-osrs-green" : "text-osrs-parchment-dark/60"}`}
            aria-live="polite"
          >
            {liveLabel}
          </span>
        </div>
      )}
      <div className="border-osrs-bronze/20 overflow-x-auto rounded border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-osrs-gold/80 text-left">
              <th className="w-12 px-3 py-2">#</th>
              {/* w-full + max-w-0 on the cells below pins the table to its
                  container and lets long names truncate instead of widening
                  the layout on narrow screens. */}
              <th className="w-full px-3 py-2">Name</th>
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
                <td className="w-full max-w-0 px-3 py-2">
                  {kind === "players" ? (
                    // Badges sit OUTSIDE the profile link so a tap on them
                    // toggles the hover card instead of navigating (the name
                    // itself still navigates on tap). The name link is
                    // shrink-0 — RSNs cap at 12 chars and must NEVER truncate;
                    // badges and the identicon tile are the second-priority
                    // elements that give way on narrow screens.
                    <EntityHoverCard
                      kind="player"
                      id={r.id}
                      name={r.name}
                      seed={{ rank: r.rank, loot: r.loot.value_formatted, badges: r.badges }}
                      className="flex min-w-0 items-center gap-1.5"
                    >
                      <EntityChip
                        href={entityPath(kind, r.id, r.name)}
                        name={r.name}
                        size="sm"
                        className="shrink-0"
                        tileClassName="max-sm:hidden"
                        playerId={r.id}
                      />
                      {r.badges?.length ? <PlayerBadgeIcons badges={r.badges} /> : null}
                    </EntityHoverCard>
                  ) : (
                    <EntityHoverCard
                      kind="group"
                      id={r.id}
                      name={r.name}
                      seed={{ rank: r.rank, loot: r.loot.value_formatted }}
                      className="flex min-w-0 items-center"
                    >
                      <EntityChip
                        href={entityPath(kind, r.id, r.name)}
                        name={r.name}
                        size="sm"
                        flair={r.flair?.style}
                        flairTitle={r.flair?.tier_name}
                      />
                    </EntityHoverCard>
                  )}
                </td>
                {/* Relative loot bar behind the value: instant read of the
                    gap between ranks without scanning the numbers. */}
                <td className="relative px-3 py-2 text-right whitespace-nowrap tabular-nums">
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
