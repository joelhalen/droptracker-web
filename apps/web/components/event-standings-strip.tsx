"use client";

/**
 * The rank/score chip strip that sits above an event's board — one chip per
 * team, best first, each opening that team's page.
 *
 * Shared by the site event page and the Discord Activity so clicking a team
 * means the same thing on both surfaces. It is deliberately NOT the board's
 * team picker: the chips on the bingo board and the loot-sweep matrix scope
 * what the board shows, and keep doing that. This strip navigates.
 */
import Link from "next/link";
import { formatEheHours, teamColorMap } from "@/lib/events";

type StandingsTeam = {
  id: number;
  name: string;
  score: number;
  color?: string | null;
  /** Roster total EHE; absent when the event keeps effort to its admins. */
  ehb_hours?: number;
  ehb_estimated_hours?: number;
};

export function EventStandingsStrip({
  eventId,
  teams,
  viewerTeamId,
  showPoints = true,
  onOpenTeam,
}: {
  eventId: number;
  /** Pass the UNSORTED roster — fallback colors are index-based, so sorting
   * here (not upstream) keeps a team's color stable as ranks move. */
  teams: StandingsTeam[];
  viewerTeamId?: number | null;
  /** False when the event awards no points (see `eventUsesPoints`): the chips
   * drop the score and rank by EHE instead. */
  showPoints?: boolean;
  /** Discord Activity: swaps the site links for in-app view pushes. */
  onOpenTeam?: (teamId: number) => void;
}) {
  if (teams.length === 0) return null;
  const teamColor = teamColorMap(teams);
  // Plain text, not the EHE HoverCard: the whole chip is a link, and a
  // tooltip trigger nested in it would fight the tap.
  const hasEhe = teams.some((t) => t.ehb_hours !== undefined);
  const standings = [...teams].sort((a, b) =>
    showPoints || !hasEhe
      ? b.score - a.score
      : (b.ehb_hours ?? 0) - (a.ehb_hours ?? 0),
  );

  return (
    <div className="flex flex-wrap gap-2">
      {standings.map((t, i) => {
        const isViewer = viewerTeamId != null && t.id === viewerTeamId;
        const label = isViewer
          ? `Open your team — roster, contributions and task progress`
          : `Open ${t.name} — roster, contributions and task progress`;
        const className = `border-osrs-bronze/30 bg-osrs-brown-dark/40 hover:border-osrs-gold/50 inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs transition-colors ${
          isViewer ? "border-osrs-gold/45" : ""
        }`;
        const body = (
          <>
            <span className="text-osrs-parchment-dark/50 tabular-nums">#{i + 1}</span>
            <span
              className="inline-block size-2 shrink-0 rounded-full"
              style={{ backgroundColor: teamColor.get(t.id) }}
              aria-hidden
            />
            <span
              className={
                isViewer
                  ? "text-osrs-gold-bright font-medium"
                  : "text-osrs-parchment-dark/85"
              }
            >
              {t.name}
            </span>
            {isViewer && <span className="text-osrs-gold/70">(yours)</span>}
            {showPoints && (
              <span className="text-osrs-gold tabular-nums">{t.score.toLocaleString()}</span>
            )}
            {t.ehb_hours !== undefined && (
              <span
                className={`tabular-nums ${
                  showPoints ? "text-osrs-parchment-dark/55" : "text-osrs-gold"
                }`}
              >
                {showPoints && <span aria-hidden className="text-osrs-parchment-dark/30 mr-1.5">·</span>}
                {formatEheHours(t.ehb_hours, (t.ehb_estimated_hours ?? 0) > 0)}{" "}
                <span className="text-[10px]">EHE</span>
              </span>
            )}
          </>
        );
        return onOpenTeam ? (
          <button
            key={t.id}
            type="button"
            onClick={() => onOpenTeam(t.id)}
            title={label}
            className={className}
          >
            {body}
          </button>
        ) : (
          <Link
            key={t.id}
            href={`/events/${eventId}/teams/${t.id}`}
            title={label}
            className={className}
          >
            {body}
          </Link>
        );
      })}
    </div>
  );
}
