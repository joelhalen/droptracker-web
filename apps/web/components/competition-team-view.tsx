"use client";

/** A Skill/Boss of the Week team's page (team races): where the team stands,
 * how it scores, its players on the race board, and who hasn't gained yet.
 * Shared by the site's team page and the Discord Activity's team view — the
 * Activity injects its transports and navigation (see CompetitionStandings). */

import Link from "next/link";
import type { Route } from "next";
import type {
  CompetitionPlayerDetail,
  EventCompetitionBoard,
  EventTeamDetail,
} from "@droptracker/api-types";
import { isTeamRace, metricSummary, teamScoreText, TEAM_SCORING_LABELS } from "@/lib/competition";
import { CompetitionStandings } from "@/components/competition-standings";

export function CompetitionTeamView({
  detail,
  board,
  live,
  viewerPlayerIds = [],
  onBack,
  onOpenPlayer,
  fetchBoard,
  fetchPlayer,
}: {
  detail: EventTeamDetail;
  board: EventCompetitionBoard;
  live: boolean;
  viewerPlayerIds?: number[];
  /** Discord Activity: the view stack's back action (the site links back). */
  onBack?: () => void;
  onOpenPlayer?: (playerId: number) => void;
  fetchBoard?: () => Promise<EventCompetitionBoard | null>;
  fetchPlayer?: (playerId: number) => Promise<CompetitionPlayerDetail | null>;
}) {
  const { event, team, members } = detail;
  const competition = board.competition;
  const teamRow = board.teams?.find((t) => t.team_id === team.id) ?? null;
  const onBoard = new Set(
    board.standings.filter((r) => r.team_id === team.id && r.player_id != null).map((r) => r.player_id),
  );
  const idle = members.filter((m) => !onBoard.has(m.player_id));
  const summary = metricSummary(competition);
  const scoreLine = teamRow
    ? (teamRow.score_text ?? teamScoreText(teamRow.score, competition))
    : teamScoreText(team.score, competition);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-xs"
          >
            ← {event.name}
          </button>
        ) : (
          <Link
            href={`/events/${event.id}` as Route}
            className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-xs"
          >
            ← {event.name}
          </Link>
        )}
        <h1 className="text-osrs-gold flex flex-wrap items-center gap-2 font-serif text-2xl font-semibold">
          {team.color && (
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: team.color }}
            />
          )}
          {team.name}
        </h1>
        {summary && <p className="text-osrs-parchment-dark/70 text-sm">{summary}</p>}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Rank" value={`#${teamRow?.rank ?? team.rank}`} sub={`of ${team.team_count}`} />
        <Stat
          label={isTeamRace(competition) ? TEAM_SCORING_LABELS[competition.team_scoring] : "Score"}
          value={scoreLine}
        />
        <Stat
          label="Members"
          value={String(teamRow?.members ?? team.member_count)}
          sub={teamRow ? `${teamRow.active} gained so far` : undefined}
        />
        <Stat
          label="Top player"
          value={teamRow?.top_player?.player_name ?? "—"}
        />
      </dl>

      <section className="space-y-3">
        <h2 className="heading-rule text-osrs-gold pb-1 text-lg font-semibold">Players</h2>
        <CompetitionStandings
          eventId={event.id}
          initial={board}
          live={live}
          teamId={team.id}
          viewerPlayerIds={viewerPlayerIds}
          {...(onOpenPlayer ? { onOpenPlayer } : {})}
          {...(fetchBoard ? { fetchBoard } : {})}
          {...(fetchPlayer ? { fetchPlayer } : {})}
        />
        {idle.length > 0 && (
          <p className="text-osrs-parchment-dark/60 text-sm">
            <span className="text-osrs-parchment-dark/80">Not on the board yet:</span>{" "}
            {idle.map((m, i) => (
              <span key={m.player_id}>
                {i > 0 && ", "}
                {onOpenPlayer ? (
                  <button
                    type="button"
                    onClick={() => onOpenPlayer(m.player_id)}
                    className="hover:text-osrs-gold-bright"
                  >
                    {m.player_name}
                  </button>
                ) : (
                  <Link
                    href={`/players/${m.player_id}` as Route}
                    className="hover:text-osrs-gold-bright"
                  >
                    {m.player_name}
                  </Link>
                )}
              </span>
            ))}
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-osrs-bronze/30 bg-osrs-brown-dark/40 min-w-0 rounded border px-3 py-2">
      <dt className="text-osrs-parchment-dark/60 text-[11px] uppercase tracking-wide">{label}</dt>
      <dd className="text-osrs-parchment truncate text-base font-semibold tabular-nums" title={value}>
        {value}
      </dd>
      {sub && <dd className="text-osrs-parchment-dark/50 text-[11px]">{sub}</dd>}
    </div>
  );
}
