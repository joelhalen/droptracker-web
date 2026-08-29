"use client";

/** SOTW/BOTW standings table (web105a): individuals ranked by gained (or
 * combined points), bonus points alongside, WOM-only participants greyed.
 * Rows with bonus points expand into the auditable award log (on-demand via
 * the BFF). Live: refetches the board on event SSE frames. */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import type {
  CompetitionPlayerDetail,
  CompetitionStandingRow,
  EventCompetitionBoard,
  RealtimeEvent,
} from "@droptracker/api-types";
import { formatGained, scoreText } from "@/lib/competition";
import { useEventStream } from "@/lib/use-event-stream";
import { EmptyState, RankMedal } from "@/components/ui";

const REFETCH_KINDS = new Set(["competition", "revoke", "recompute", "ended"]);

export function CompetitionStandings({
  eventId,
  initial,
  live,
  viewerPlayerIds = [],
}: {
  eventId: number;
  initial: EventCompetitionBoard;
  live: boolean;
  /** The signed-in viewer's claimed players — their rows get the accent. */
  viewerPlayerIds?: number[];
}) {
  const [board, setBoard] = useState(initial);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, CompetitionPlayerDetail | "loading">>({});
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) return; // trailing-edge debounce
    refetchTimer.current = setTimeout(async () => {
      refetchTimer.current = null;
      try {
        const res = await fetch(`/api/events/${eventId}/competition`);
        if (res.ok) setBoard((await res.json()) as EventCompetitionBoard);
      } catch {
        /* next frame retries */
      }
    }, 1500);
  }, [eventId]);

  const onFrame = useCallback(
    (frame: RealtimeEvent) => {
      if (frame.type !== "event_update") return;
      const kind = (frame.data as { kind?: string }).kind;
      if (kind && REFETCH_KINDS.has(kind)) scheduleRefetch();
    },
    [scheduleRefetch],
  );
  useEventStream(live ? [`event:${eventId}`] : [], onFrame);
  useEffect(
    () => () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
    },
    [],
  );

  const { competition, standings } = board;
  const metricKind = competition.metric.kind;
  const rankingMode = competition.ranking.mode;
  const pointsMode = rankingMode === "points";
  const hasBonuses = competition.bonus_rules.length > 0;

  const toggleRow = (row: CompetitionStandingRow) => {
    if (!row.registered || row.player_id == null) return;
    const pid = row.player_id;
    if (expanded === pid) {
      setExpanded(null);
      return;
    }
    setExpanded(pid);
    if (!details[pid]) {
      setDetails((d) => ({ ...d, [pid]: "loading" }));
      fetch(`/api/events/${eventId}/competition/players/${pid}`)
        .then(async (res) => (res.ok ? ((await res.json()) as CompetitionPlayerDetail) : null))
        .then((detail) =>
          setDetails((d) => ({ ...d, [pid]: detail ?? { event_id: eventId, player_id: pid, row: null, awards: [] } })),
        )
        .catch(() =>
          setDetails((d) => ({ ...d, [pid]: { event_id: eventId, player_id: pid, row: null, awards: [] } })),
        );
    }
  };

  if (!standings.length) {
    return (
      <EmptyState
        title={board.status === "draft" ? "Standings appear when the race starts." : "No gains yet"}
        hint={
          board.status === "draft"
            ? undefined
            : "The first tracked kill or XP drop opens the board."
        }
      />
    );
  }

  return (
    <div className="border-osrs-bronze/30 overflow-x-auto rounded border">
      <table className="w-full min-w-[26rem] text-sm">
        <thead>
          <tr className="border-osrs-bronze/30 text-osrs-parchment-dark/60 border-b text-left text-xs">
            <th className="w-12 px-2.5 py-2 font-normal">#</th>
            <th className="px-2.5 py-2 font-normal">Player</th>
            <th className="px-2.5 py-2 text-right font-normal">
              {metricKind === "skill" ? "XP gained" : "KC gained"}
            </th>
            {hasBonuses && <th className="px-2.5 py-2 text-right font-normal">Bonus</th>}
            {pointsMode && <th className="px-2.5 py-2 text-right font-normal">Points</th>}
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => {
            const isViewer =
              row.player_id != null && viewerPlayerIds.includes(row.player_id);
            const expandable = row.registered && row.player_id != null && row.bonus_points > 0;
            const isOpen = expanded != null && expanded === row.player_id;
            const detail = row.player_id != null ? details[row.player_id] : undefined;
            return (
              <RowGroup key={`${row.player_id ?? "wom"}-${row.wom_player_id ?? row.rank}`}>
                <tr
                  onClick={expandable ? () => toggleRow(row) : undefined}
                  className={`border-osrs-bronze/15 border-b last:border-b-0 ${
                    row.registered ? "" : "opacity-50"
                  } ${isViewer ? "bg-osrs-brown-dark/50" : ""} ${
                    expandable ? "hover:bg-osrs-brown-dark/40 cursor-pointer" : ""
                  }`}
                >
                  <td className="px-2.5 py-2">
                    <RankMedal rank={row.rank} />
                  </td>
                  <td className="px-2.5 py-2">
                    {row.registered && row.player_id != null ? (
                      <Link
                        href={`/players/${row.player_id}` as Route}
                        onClick={(e) => e.stopPropagation()}
                        className="text-osrs-parchment hover:text-osrs-gold-bright"
                      >
                        {row.player_name}
                      </Link>
                    ) : (
                      <span className="text-osrs-parchment">
                        {row.player_name}
                        <span className="border-osrs-bronze/40 text-osrs-parchment-dark/60 ml-1.5 rounded border px-1 py-px text-[10px] uppercase">
                          WOM
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="text-osrs-parchment px-2.5 py-2 text-right tabular-nums">
                    {formatGained(row.gained, metricKind)}
                  </td>
                  {hasBonuses && (
                    <td className="text-osrs-parchment-dark/80 px-2.5 py-2 text-right tabular-nums">
                      {row.bonus_points > 0 ? `+${row.bonus_points.toLocaleString("en-US")}` : "—"}
                      {expandable && (
                        <span className="text-osrs-parchment-dark/40 ml-1 text-[10px]">
                          {isOpen ? "▲" : "▼"}
                        </span>
                      )}
                    </td>
                  )}
                  {pointsMode && (
                    <td className="text-osrs-gold-bright px-2.5 py-2 text-right font-medium tabular-nums">
                      {row.points.toLocaleString("en-US")}
                    </td>
                  )}
                </tr>
                {isOpen && (
                  <tr className="border-osrs-bronze/15 bg-osrs-brown-dark/30 border-b">
                    <td colSpan={3 + (hasBonuses ? 1 : 0) + (pointsMode ? 1 : 0)} className="px-4 py-2.5">
                      {detail === "loading" || detail === undefined ? (
                        <p className="text-osrs-parchment-dark/50 text-xs">Loading awards…</p>
                      ) : detail.awards.length ? (
                        <ul className="space-y-1 text-xs">
                          {detail.awards.map((a, i) => (
                            <li key={i} className="flex items-center justify-between gap-2">
                              <span
                                className={
                                  a.counted
                                    ? "text-osrs-parchment-dark/80"
                                    : "text-osrs-parchment-dark/40 line-through"
                                }
                              >
                                {a.label ?? "Bonus award"}
                              </span>
                              <span className="text-osrs-green shrink-0 tabular-nums">
                                +{a.points} pts
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-osrs-parchment-dark/50 text-xs">No bonus awards yet.</p>
                      )}
                    </td>
                  </tr>
                )}
              </RowGroup>
            );
          })}
        </tbody>
      </table>
      <p className="text-osrs-parchment-dark/40 border-osrs-bronze/20 border-t px-2.5 py-1.5 text-[11px]">
        {board.totals.participants} player{board.totals.participants === 1 ? "" : "s"} ·{" "}
        {formatGained(board.totals.gained, metricKind)} gained
        {hasBonuses ? ` · ${board.totals.bonus_points.toLocaleString("en-US")} bonus pts` : ""}
        {board.finalized ? " · final" : ""}
        {competition.wom ? " · greyed rows are WiseOldMan participants without a DropTracker account" : ""}
      </p>
    </div>
  );
}

/** Fragment wrapper so an expanded row's pair stays keyed together. */
function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/** Top-3 podium chips — the compact strip above the table. */
export function CompetitionTopStrip({ board }: { board: EventCompetitionBoard }) {
  const top = board.standings.slice(0, 3);
  if (!top.length) return null;
  const metricKind = board.competition.metric.kind;
  const mode = board.competition.ranking.mode;
  return (
    <ol className="flex flex-wrap gap-2">
      {top.map((row) => (
        <li
          key={row.rank}
          className="border-osrs-bronze/40 bg-osrs-brown-dark/50 flex items-center gap-2 rounded border px-2.5 py-1.5 text-sm"
        >
          <RankMedal rank={row.rank} />
          <span className="text-osrs-parchment">{row.player_name}</span>
          <span className="text-osrs-gold-bright tabular-nums">
            {scoreText(mode === "points" ? row.points : row.gained, mode, metricKind)}
          </span>
        </li>
      ))}
    </ol>
  );
}
