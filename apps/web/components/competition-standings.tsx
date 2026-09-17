"use client";

/** SOTW/BOTW standings (web105a): individuals ranked by gained (or combined
 * points), bonus points alongside, WOM-only participants greyed. Rows with
 * bonus state expand into the auditable award log (fetched on demand). Live:
 * refetches the board on event SSE frames.
 *
 * A TEAM race adds the team table above the player table (ranked by the
 * team's summed or per-member score), a team column, and a team filter.
 *
 * Shared with the Discord Activity: data transport and navigation are
 * injectable (`fetchBoard` / `fetchPlayer`, `onOpenPlayer` / `onOpenTeam`) —
 * the site defaults to its cookie BFF and plain links, which would leave the
 * iframe. */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import type {
  CompetitionPlayerDetail,
  CompetitionStandingRow,
  CompetitionTeamStanding,
  EventCompetitionBoard,
  RealtimeEvent,
} from "@droptracker/api-types";
import { ToggleChip } from "@droptracker/ui";
import { formatGained, isTeamRace, scoreText, teamScoreText } from "@/lib/competition";
import { teamColorMap } from "@/lib/events";
import { useEventStream } from "@/lib/use-event-stream";
import { EmptyState, RankMedal } from "@/components/ui";

const REFETCH_KINDS = new Set(["competition", "revoke", "recompute", "ended"]);

type BoardFetcher = () => Promise<EventCompetitionBoard | null>;
type PlayerFetcher = (playerId: number) => Promise<CompetitionPlayerDetail | null>;

async function siteBoard(eventId: number): Promise<EventCompetitionBoard | null> {
  const res = await fetch(`/api/events/${eventId}/competition`);
  return res.ok ? ((await res.json()) as EventCompetitionBoard) : null;
}

async function sitePlayer(eventId: number, playerId: number): Promise<CompetitionPlayerDetail | null> {
  const res = await fetch(`/api/events/${eventId}/competition/players/${playerId}`);
  return res.ok ? ((await res.json()) as CompetitionPlayerDetail) : null;
}

/** A player's in-flight bonus meters: the rules that track progress toward a
 * threshold (task / milestone) and have moved at all. Discrete rules
 * (pet, fast kill) never carry `need`, so they never show a meter. */
function bonusProgressSlots(row: CompetitionStandingRow) {
  const out: { ruleId: number; progress: number; need: number; awarded: number }[] = [];
  for (const [key, slot] of Object.entries(row.bonus ?? {})) {
    const need = slot.need ?? 0;
    const progress = slot.progress ?? 0;
    if (need <= 0 || progress <= 0) continue;
    out.push({ ruleId: Number(key), progress, need, awarded: slot.awarded });
  }
  return out.sort((a, b) => a.ruleId - b.ruleId);
}

/** Team id → accent, stable across re-ranks (palette by id order, like every
 * other team surface's unsorted roster). */
function teamAccents(teams: CompetitionTeamStanding[] | undefined): Map<number, string> {
  const byId = [...(teams ?? [])].sort((a, b) => a.team_id - b.team_id);
  return teamColorMap(byId.map((t) => ({ id: t.team_id, color: t.color ?? null })));
}

function TeamDot({ color }: { color: string | undefined }) {
  if (!color) return null;
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

export function CompetitionStandings({
  eventId,
  initial,
  live,
  viewerPlayerIds = [],
  viewerTeamId = null,
  fetchBoard,
  fetchPlayer,
  onOpenPlayer,
  onOpenTeam,
  teamId = null,
}: {
  eventId: number;
  initial: EventCompetitionBoard;
  live: boolean;
  /** A team page: show only this team's players (no team table/filter). */
  teamId?: number | null;
  /** The signed-in viewer's claimed players — their rows get the accent. */
  viewerPlayerIds?: number[];
  /** Team race: the viewer's team, accented in the team table. */
  viewerTeamId?: number | null;
  /** Discord Activity: bearer-token transports (defaults: the site BFF). */
  fetchBoard?: BoardFetcher;
  fetchPlayer?: PlayerFetcher;
  /** Discord Activity: in-app view pushes instead of site links. */
  onOpenPlayer?: (playerId: number) => void;
  onOpenTeam?: (teamId: number) => void;
}) {
  const [board, setBoard] = useState(initial);
  useEffect(() => setBoard(initial), [initial]);
  // Rule id -> its sentence, so a meter can say what it is a meter FOR.
  const ruleLabels = new Map(board.competition.bonus_rules.map((r) => [r.id, r.label]));
  const [expanded, setExpanded] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, CompetitionPlayerDetail | "loading">>({});
  const [teamFilter, setTeamFilter] = useState<number | null>(null);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadBoard = useCallback<BoardFetcher>(
    () => (fetchBoard ? fetchBoard() : siteBoard(eventId)),
    [fetchBoard, eventId],
  );
  const loadPlayer = useCallback<PlayerFetcher>(
    (pid) => (fetchPlayer ? fetchPlayer(pid) : sitePlayer(eventId, pid)),
    [fetchPlayer, eventId],
  );

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) return; // trailing-edge debounce
    refetchTimer.current = setTimeout(async () => {
      refetchTimer.current = null;
      try {
        const next = await loadBoard();
        if (next) setBoard(next);
      } catch {
        /* next frame retries */
      }
    }, 1500);
  }, [loadBoard]);

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

  const { competition } = board;
  const teamRace = isTeamRace(competition) && (board.teams?.length ?? 0) > 0;
  const accents = useMemo(() => teamAccents(board.teams), [board.teams]);
  const activeFilter = teamId ?? teamFilter;
  const standings = useMemo(
    () =>
      teamRace && activeFilter != null
        ? board.standings.filter((r) => r.team_id === activeFilter)
        : board.standings,
    [board.standings, activeFilter, teamRace],
  );
  // The team table and filter belong to the whole-race view only.
  const showTeams = teamRace && teamId == null;
  const metricKind = competition.metric.kind;
  const rankingMode = competition.ranking.mode;
  const pointsMode = rankingMode === "points";
  const hasBonuses = competition.bonus_rules.length > 0;
  const showTeamColumn = showTeams;
  const columns = 3 + (showTeamColumn ? 1 : 0) + (hasBonuses ? 1 : 0) + (pointsMode ? 1 : 0);

  const toggleRow = (row: CompetitionStandingRow) => {
    if (!row.registered || row.player_id == null) return;
    const pid = row.player_id;
    if (expanded === pid) {
      setExpanded(null);
      return;
    }
    setExpanded(pid);
    if (!details[pid]) {
      const empty = { event_id: eventId, player_id: pid, row: null, awards: [] };
      setDetails((d) => ({ ...d, [pid]: "loading" }));
      loadPlayer(pid)
        .then((detail) => setDetails((d) => ({ ...d, [pid]: detail ?? empty })))
        .catch(() => setDetails((d) => ({ ...d, [pid]: empty })));
    }
  };

  const playerName = (row: CompetitionStandingRow): ReactNode => {
    if (!(row.registered && row.player_id != null)) {
      return (
        <span className="text-osrs-parchment">
          {row.player_name}
          <span className="border-osrs-bronze/40 text-osrs-parchment-dark/60 ml-1.5 rounded border px-1 py-px text-[10px] uppercase">
            WOM
          </span>
        </span>
      );
    }
    const pid = row.player_id;
    if (onOpenPlayer) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenPlayer(pid);
          }}
          className="text-osrs-parchment hover:text-osrs-gold-bright text-left"
        >
          {row.player_name}
        </button>
      );
    }
    return (
      <Link
        href={`/players/${pid}` as Route}
        onClick={(e) => e.stopPropagation()}
        className="text-osrs-parchment hover:text-osrs-gold-bright"
      >
        {row.player_name}
      </Link>
    );
  };

  if (!board.standings.length && !teamRace) {
    return (
      <EmptyState
        title={board.status === "draft" ? "Standings appear when the race starts." : "No gains yet"}
        hint={
          board.status === "draft" ? undefined : "The first tracked kill or XP drop opens the board."
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {showTeams && (
        <CompetitionTeamTable
          board={board}
          accents={accents}
          viewerTeamId={viewerTeamId}
          selected={teamFilter}
          onSelect={(id) => setTeamFilter((cur) => (cur === id ? null : id))}
          eventId={eventId}
          onOpenTeam={onOpenTeam}
        />
      )}

      {showTeams && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter players by team">
          <ToggleChip active={teamFilter == null} onClick={() => setTeamFilter(null)}>
            All players
          </ToggleChip>
          {(board.teams ?? []).map((t) => (
            <ToggleChip
              key={t.team_id}
              active={teamFilter === t.team_id}
              onClick={() => setTeamFilter((cur) => (cur === t.team_id ? null : t.team_id))}
              className="inline-flex items-center gap-1.5"
            >
              <TeamDot color={accents.get(t.team_id)} />
              {t.name}
            </ToggleChip>
          ))}
        </div>
      )}

      {standings.length === 0 ? (
        <EmptyState
          title={
            board.status === "draft"
              ? "Standings appear when the race starts."
              : activeFilter != null
                ? "Nobody on this team has gained yet"
                : "No gains yet"
          }
        />
      ) : (
        <div className="border-osrs-bronze/30 overflow-x-auto rounded border">
          <table className="w-full min-w-[26rem] text-sm">
            <thead>
              <tr className="border-osrs-bronze/30 text-osrs-parchment-dark/60 border-b text-left text-xs">
                <th className="w-12 px-2.5 py-2 font-normal">#</th>
                <th className="px-2.5 py-2 font-normal">Player</th>
                {showTeamColumn && <th className="px-2.5 py-2 font-normal">Team</th>}
                <th className="px-2.5 py-2 text-right font-normal">
                  {metricKind === "skill" ? "XP gained" : "KC gained"}
                </th>
                {hasBonuses && <th className="px-2.5 py-2 text-right font-normal">Bonus</th>}
                {pointsMode && <th className="px-2.5 py-2 text-right font-normal">Points</th>}
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => {
                const isViewer = row.player_id != null && viewerPlayerIds.includes(row.player_id);
                // Expandable on any bonus STATE, not just points scored: a
                // player three items into a five-item set has earned nothing
                // yet and is exactly the person who wants to see the meter.
                const inFlight = bonusProgressSlots(row);
                const expandable =
                  row.registered &&
                  row.player_id != null &&
                  (row.bonus_points > 0 || inFlight.length > 0);
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
                      <td className="px-2.5 py-2">{playerName(row)}</td>
                      {showTeamColumn && (
                        <td className="text-osrs-parchment-dark/80 px-2.5 py-2">
                          {row.team_name ? (
                            <span className="inline-flex items-center gap-1.5">
                              <TeamDot
                                color={row.team_id != null ? accents.get(row.team_id) : undefined}
                              />
                              {row.team_name}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                      <td className="text-osrs-parchment px-2.5 py-2 text-right tabular-nums">
                        {formatGained(row.gained, metricKind)}
                      </td>
                      {hasBonuses && (
                        <td className="text-osrs-parchment-dark/80 px-2.5 py-2 text-right tabular-nums">
                          {row.bonus_points > 0
                            ? `+${row.bonus_points.toLocaleString("en-US")}`
                            : "—"}
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
                        <td colSpan={columns} className="px-4 py-2.5">
                          {inFlight.length > 0 && (
                            <ul className="mb-2 space-y-1.5 text-xs">
                              {inFlight.map(({ ruleId, progress, need, awarded }) => (
                                <li key={`p-${ruleId}`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-osrs-parchment-dark/70">
                                      {ruleLabels.get(ruleId) ?? "Bonus"}
                                    </span>
                                    <span className="text-osrs-parchment-dark/50 shrink-0 tabular-nums">
                                      {Math.min(progress, need).toLocaleString("en-US")} /{" "}
                                      {need.toLocaleString("en-US")}
                                      {awarded > 0 ? ` · ${awarded} earned` : ""}
                                    </span>
                                  </div>
                                  <div className="bg-osrs-brown-dark/70 mt-1 h-1 overflow-hidden rounded">
                                    <div
                                      className="bg-osrs-gold h-full"
                                      style={{
                                        width: `${Math.min(100, Math.round((progress / need) * 100))}%`,
                                      }}
                                    />
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
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
                                    {/* A task rule's row is progress, not a
                                        payout — it pays at the rule level,
                                        shown in the meter above. Printing
                                        "+0 pts" on every drop would read as a
                                        bug. */}
                                    {a.contribution != null && a.points === 0
                                      ? `+${a.contribution.toLocaleString("en-US")}`
                                      : `+${a.points} pts`}
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
            {competition.wom
              ? " · greyed rows are WiseOldMan participants without a DropTracker account"
              : ""}
          </p>
        </div>
      )}
    </div>
  );
}

/** Fragment wrapper so an expanded row's pair stays keyed together. */
function RowGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** A team race's team table: ranked score (worded), gained, members, and
 * each team's top player. A row click filters the player table below; the
 * team name opens the team's page. */
function CompetitionTeamTable({
  board,
  accents,
  viewerTeamId,
  selected,
  onSelect,
  eventId,
  onOpenTeam,
}: {
  board: EventCompetitionBoard;
  accents: Map<number, string>;
  viewerTeamId: number | null;
  selected: number | null;
  onSelect: (teamId: number) => void;
  eventId: number;
  onOpenTeam?: (teamId: number) => void;
}) {
  const { competition } = board;
  const teams = board.teams ?? [];
  const averaging = competition.team_scoring === "average";
  const metricKind = competition.metric.kind;
  const mode = competition.ranking.mode;
  return (
    <div className="border-osrs-bronze/30 overflow-x-auto rounded border">
      <table className="w-full min-w-[24rem] text-sm">
        <thead>
          <tr className="border-osrs-bronze/30 text-osrs-parchment-dark/60 border-b text-left text-xs">
            <th className="w-12 px-2.5 py-2 font-normal">#</th>
            <th className="px-2.5 py-2 font-normal">Team</th>
            <th className="px-2.5 py-2 text-right font-normal">
              {averaging ? "Per member" : mode === "points" ? "Points" : "Gained"}
            </th>
            {averaging && <th className="px-2.5 py-2 text-right font-normal">Total</th>}
            <th className="px-2.5 py-2 text-right font-normal">Members</th>
            <th className="hidden px-2.5 py-2 font-normal sm:table-cell">Top player</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => {
            const mine = viewerTeamId != null && viewerTeamId === t.team_id;
            const isSelected = selected === t.team_id;
            return (
              <tr
                key={t.team_id}
                onClick={() => onSelect(t.team_id)}
                aria-selected={isSelected}
                className={`border-osrs-bronze/15 hover:bg-osrs-brown-dark/40 cursor-pointer border-b last:border-b-0 ${
                  isSelected ? "bg-osrs-brown-dark/60" : mine ? "bg-osrs-brown-dark/40" : ""
                }`}
              >
                <td className="px-2.5 py-2">
                  <RankMedal rank={t.rank} />
                </td>
                <td className="px-2.5 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <TeamDot color={accents.get(t.team_id)} />
                    {onOpenTeam ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenTeam(t.team_id);
                        }}
                        className="text-osrs-parchment hover:text-osrs-gold-bright text-left font-medium"
                      >
                        {t.name}
                      </button>
                    ) : (
                      <Link
                        href={`/events/${eventId}/teams/${t.team_id}` as Route}
                        onClick={(e) => e.stopPropagation()}
                        className="text-osrs-parchment hover:text-osrs-gold-bright font-medium"
                      >
                        {t.name}
                      </Link>
                    )}
                    {mine && (
                      <span className="text-osrs-gold-bright text-[10px] uppercase">your team</span>
                    )}
                  </span>
                </td>
                <td className="text-osrs-gold-bright px-2.5 py-2 text-right font-medium tabular-nums">
                  {t.score_text ?? teamScoreText(t.score, competition)}
                </td>
                {averaging && (
                  <td className="text-osrs-parchment-dark/80 px-2.5 py-2 text-right tabular-nums">
                    {scoreText(t.total, mode, metricKind)}
                  </td>
                )}
                <td className="text-osrs-parchment-dark/80 px-2.5 py-2 text-right tabular-nums">
                  {t.active}/{t.members}
                </td>
                <td className="text-osrs-parchment-dark/80 hidden px-2.5 py-2 sm:table-cell">
                  {t.top_player
                    ? `${t.top_player.player_name} · ${scoreText(t.top_player.value, mode, metricKind)}`
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-osrs-parchment-dark/40 border-osrs-bronze/20 border-t px-2.5 py-1.5 text-[11px]">
        {averaging
          ? "Teams rank by their total divided by everyone who has been on the team. "
          : "Teams rank by everything their members gained. "}
        Members shows who has gained anything out of the whole roster. Tap a team to filter the
        players below.
      </p>
    </div>
  );
}

/** Top-3 chips — the compact strip above the page. Teams on a team race,
 * players otherwise. */
export function CompetitionTopStrip({ board }: { board: EventCompetitionBoard }) {
  const metricKind = board.competition.metric.kind;
  const mode = board.competition.ranking.mode;
  if (isTeamRace(board.competition) && board.teams?.length) {
    const accents = teamAccents(board.teams);
    return (
      <ol className="flex flex-wrap gap-2">
        {board.teams.slice(0, 3).map((t) => (
          <li
            key={t.team_id}
            className="border-osrs-bronze/40 bg-osrs-brown-dark/50 flex items-center gap-2 rounded border px-2.5 py-1.5 text-sm"
          >
            <RankMedal rank={t.rank} />
            <TeamDot color={accents.get(t.team_id)} />
            <span className="text-osrs-parchment">{t.name}</span>
            <span className="text-osrs-gold-bright tabular-nums">
              {t.score_text ?? teamScoreText(t.score, board.competition)}
            </span>
          </li>
        ))}
      </ol>
    );
  }
  const top = board.standings.slice(0, 3);
  if (!top.length) return null;
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
