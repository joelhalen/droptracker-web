"use client";

import { useMemo, useState } from "react";
import type { EventEffortReport, EventEffortReportRow } from "@droptracker/api-types";
import { Card, EmptyState, StatTile } from "@/components/ui";
import { effortSummary, formatEhbHours } from "@/lib/events";

/**
 * Bingo EHB participation report.
 *
 * The question it answers, verbatim from the suggestion thread: "if you're 5
 * days into a weeklong bingo and someone's last activity was 3 days ago,
 * unless you hear from them, they're probably inactive." So it lists the whole
 * roster quietest-first, and a member with NO recorded effort sorts to the very
 * top rather than being omitted — they're the answer, not a missing row.
 *
 * "Effort" here is scoped to the bosses this event's tasks care about. A player
 * can be grinding all week and still show zero if none of it feeds a tile,
 * which is the distinction global EHB can't make.
 */
export function EventEffortPanel({ report }: { report: EventEffortReport }) {
  const [teamFilter, setTeamFilter] = useState<number | "all">("all");

  const teams = useMemo(() => {
    const seen = new Map<number, string>();
    for (const p of report.players) {
      if (p.team_id != null && !seen.has(p.team_id)) {
        seen.set(p.team_id, p.team_name ?? `Team ${p.team_id}`);
      }
    }
    return [...seen.entries()];
  }, [report]);

  const rows = useMemo(
    () =>
      teamFilter === "all"
        ? report.players
        : report.players.filter((p) => p.team_id === teamFilter),
    [report, teamFilter],
  );

  const quiet = rows.filter((p) => p.never_active || (p.days_idle ?? 0) >= 2).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Participants" value={report.totals.participants} />
        <StatTile
          label="Active"
          value={report.totals.active}
          hint="have at least one relevant kill"
        />
        <StatTile
          label="Quiet 2+ days"
          value={quiet}
          hint="including never-active members"
        />
        <StatTile
          label="Total effort"
          value={formatEhbHours(report.totals.ehb_hours)}
          hint={report.rates_known ? "ehb at this event's bosses" : "EHB rates unavailable"}
        />
      </div>

      {teams.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setTeamFilter("all")}
            aria-pressed={teamFilter === "all"}
            className={`rounded border px-2 py-1 ${
              teamFilter === "all"
                ? "border-osrs-gold/45 text-osrs-gold"
                : "border-osrs-bronze/25 text-osrs-parchment-dark/70"
            }`}
          >
            All teams
          </button>
          {teams.map(([tid, name]) => (
            <button
              key={tid}
              type="button"
              onClick={() => setTeamFilter(tid)}
              aria-pressed={teamFilter === tid}
              className={`rounded border px-2 py-1 ${
                teamFilter === tid
                  ? "border-osrs-gold/45 text-osrs-gold"
                  : "border-osrs-bronze/25 text-osrs-parchment-dark/70"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title="Nobody on the roster"
            hint="Add participants to the event and their effort will show up here."
          />
        ) : (
          <ul className="divide-osrs-bronze/15 divide-y">
            {rows.map((p) => (
              <EffortRow key={p.player_id} player={p} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function idleLabel(p: EventEffortReportRow): string {
  if (p.never_active) return "Never seen at a relevant boss";
  const days = p.days_idle ?? 0;
  if (days < 1) return "Active today";
  if (days < 2) return "Active yesterday";
  return `Quiet for ${Math.floor(days)} days`;
}

function EffortRow({ player }: { player: EventEffortReportRow }) {
  // Amber for a couple of quiet days, red once they've effectively stopped —
  // the same escalation a leader would apply by eye.
  const days = player.days_idle ?? 0;
  const tone = player.never_active || days >= 4
    ? "text-red-400/90"
    : days >= 2
      ? "text-amber-400/90"
      : "text-osrs-parchment-dark/50";

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      <span className="min-w-0 flex-1 break-words">
        <span className="text-osrs-parchment/90 font-medium">
          {player.player_name ?? `Player ${player.player_id}`}
        </span>
        {player.team_name && (
          <span className="text-osrs-parchment-dark/40 ml-2 text-xs">{player.team_name}</span>
        )}
        <span className={`block text-xs ${tone}`}>{idleLabel(player)}</span>
      </span>
      <span className="text-osrs-parchment-dark/60 shrink-0 text-xs">
        {effortSummary(player)}
      </span>
      <span className="text-osrs-parchment-dark/80 w-16 shrink-0 text-right tabular-nums">
        {formatEhbHours(player.ehb_hours)}
      </span>
    </li>
  );
}
