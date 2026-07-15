"use client";

/**
 * Event-page "Teams" standings aside. Each team shows its rank, color, name,
 * player count, tasks done, and score. Rosters stay compact: small teams list
 * inline, but large teams (the clan-vs-clan case, 400+ members) collapse behind
 * a disclosure that reveals a searchable, paginated `EventMemberList` — so a
 * massive event no longer turns the page into an endless scroll.
 */
import Link from "next/link";
import type { EventMember, EventProgress, EventTeam } from "@droptracker/api-types";
import { entityPath } from "@/lib/slug";
import { teamColorMap } from "@/lib/events";
import { LocalTime } from "@/components/local-time";
import { EventMemberList } from "@/components/event-member-list";

/** Rosters up to this size render inline; larger ones collapse. */
const INLINE_MAX = 6;

function MemberRow({ m }: { m: EventMember }) {
  return (
    <li key={m.player_id} className="flex items-center justify-between">
      <Link
        href={entityPath("players", m.player_id, m.player_name)}
        className="hover:text-osrs-gold-bright"
      >
        {m.player_name}
      </Link>
      {m.joined_at != null && (
        <span className="text-osrs-parchment-dark/40">
          joined <LocalTime unix={m.joined_at} mode="date" />
        </span>
      )}
    </li>
  );
}

export function EventTeamsPanel({
  eventId,
  teams,
  progress,
  taskCount,
  viewerTeamId,
}: {
  eventId: number;
  teams: EventTeam[];
  progress?: EventProgress[];
  taskCount: number;
  viewerTeamId?: number | null;
}) {
  // Colors resolve against the unsorted roster so palette fallbacks stay stable
  // as standings change.
  const teamColor = teamColorMap(teams);
  const sorted = [...teams].sort((a, b) => b.score - a.score);

  return (
    <ol className="space-y-2">
      {sorted.map((team, i) => {
        const done = (progress ?? []).filter((p) => p.team_id === team.id && p.completed).length;
        const members = team.members ?? [];
        const isViewer = viewerTeamId != null && team.id === viewerTeamId;
        return (
          <li
            key={team.id}
            className={`rounded border px-3 py-2 text-sm transition-colors ${
              isViewer
                ? "border-osrs-gold/40"
                : "border-osrs-bronze/20 hover:border-osrs-bronze/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span>
                <span className="text-osrs-parchment-dark/50 mr-2 tabular-nums">{i + 1}</span>
                <span
                  className="mr-1.5 inline-block size-2 rounded-full align-baseline"
                  style={{ backgroundColor: teamColor.get(team.id) }}
                  aria-hidden
                />
                <Link
                  href={`/events/${eventId}/teams/${team.id}`}
                  className="hover:text-osrs-gold-bright font-medium"
                >
                  {team.name}
                </Link>
                <span className="text-osrs-parchment-dark/50 ml-2 text-xs">
                  {team.member_count} players
                  {done > 0 ? ` · ${done}/${taskCount} tasks` : ""}
                </span>
              </span>
              <span className="text-osrs-gold-bright tabular-nums">{team.score}</span>
            </div>

            {members.length > 0 && members.length <= INLINE_MAX && (
              <ul className="text-osrs-parchment-dark/70 mt-2 space-y-0.5 text-xs">
                {members.map((m) => (
                  <MemberRow key={m.player_id} m={m} />
                ))}
              </ul>
            )}

            {members.length > INLINE_MAX && (
              <details className="group mt-2">
                <summary className="text-osrs-gold/70 hover:text-osrs-gold-bright cursor-pointer list-none text-xs select-none [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">Show roster ({members.length})</span>
                  <span className="hidden group-open:inline">Hide roster</span>
                </summary>
                <div className="mt-2">
                  <EventMemberList
                    members={members}
                    pageSize={8}
                    listClassName="text-osrs-parchment-dark/70 space-y-0.5 text-xs"
                    renderRow={(m) => <MemberRow key={m.player_id} m={m} />}
                  />
                </div>
              </details>
            )}
          </li>
        );
      })}
    </ol>
  );
}
