/** Static SOTW/BOTW standings table for the Discord board image (web105a) —
 * the chrome-less snapshot services/event_board_image.py screenshots. Top 10,
 * fixed width, no interactivity. Mirrors the live table's numbers exactly
 * (same fold, same formatting) so the Discord picture never disagrees with
 * the site. */

import type { EventCompetitionBoard } from "@droptracker/api-types";
import {
  formatGained,
  isTeamRace,
  metricSummary,
  scoreText,
  teamScoreText,
} from "@/lib/competition";

const medals = ["🥇", "🥈", "🥉"];

function Place({ rank }: { rank: number }) {
  return rank <= 3 ? (
    <>{medals[rank - 1]}</>
  ) : (
    <span className="text-osrs-parchment-dark/70 tabular-nums">{rank}</span>
  );
}

export function CompetitionStandingsSnapshot({ board }: { board: EventCompetitionBoard }) {
  const { competition, standings, totals } = board;
  const metricKind = competition.metric.kind;
  const mode = competition.ranking.mode;
  const pointsMode = mode === "points";
  const hasBonuses = competition.bonus_rules.length > 0;
  const teams = isTeamRace(competition) ? (board.teams ?? []) : [];
  // A team race leads with its teams; the player list below it is shorter.
  const top = standings.slice(0, teams.length ? 5 : 10);
  const summary = metricSummary(competition);

  return (
    <div className="border-osrs-bronze/40 bg-osrs-brown-dark/40 rounded border p-4">
      {summary && <p className="text-osrs-parchment-dark/80 mb-2 text-sm">⚔️ {summary}</p>}
      {teams.length > 0 && (
        <table className="mb-3 w-full text-sm">
          <thead>
            <tr className="border-osrs-bronze/30 text-osrs-parchment-dark/60 border-b text-left text-xs">
              <th className="w-10 px-2 py-1.5 font-normal">#</th>
              <th className="px-2 py-1.5 font-normal">Team</th>
              <th className="px-2 py-1.5 text-right font-normal">Score</th>
              <th className="px-2 py-1.5 text-right font-normal">Top player</th>
            </tr>
          </thead>
          <tbody>
            {teams.slice(0, 8).map((t) => (
              <tr key={t.team_id} className="border-osrs-bronze/15 border-b last:border-b-0">
                <td className="px-2 py-1.5">
                  <Place rank={t.rank} />
                </td>
                <td className="text-osrs-parchment px-2 py-1.5 font-medium">
                  {t.color && (
                    <span
                      aria-hidden
                      className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                      style={{ backgroundColor: t.color }}
                    />
                  )}
                  {t.name}
                </td>
                <td className="text-osrs-gold-bright px-2 py-1.5 text-right font-medium tabular-nums">
                  {t.score_text ?? teamScoreText(t.score, competition)}
                </td>
                <td className="text-osrs-parchment-dark/80 px-2 py-1.5 text-right">
                  {t.top_player
                    ? `${t.top_player.player_name} (${scoreText(t.top_player.value, mode, metricKind)})`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-osrs-bronze/30 text-osrs-parchment-dark/60 border-b text-left text-xs">
            <th className="w-10 px-2 py-1.5 font-normal">#</th>
            <th className="px-2 py-1.5 font-normal">Player</th>
            <th className="px-2 py-1.5 text-right font-normal">
              {metricKind === "skill" ? "XP gained" : "KC gained"}
            </th>
            {hasBonuses && <th className="px-2 py-1.5 text-right font-normal">Bonus</th>}
            {pointsMode && <th className="px-2 py-1.5 text-right font-normal">Points</th>}
          </tr>
        </thead>
        <tbody>
          {top.map((row) => (
            <tr
              key={`${row.player_id ?? "wom"}-${row.wom_player_id ?? row.rank}`}
              className={`border-osrs-bronze/15 border-b last:border-b-0 ${
                row.registered ? "" : "opacity-50"
              }`}
            >
              <td className="px-2 py-1.5">
                <Place rank={row.rank} />
              </td>
              <td className="text-osrs-parchment px-2 py-1.5">
                {row.player_name}
                {teams.length > 0 && row.team_name && (
                  <span className="text-osrs-parchment-dark/60 ml-1.5 text-xs">{row.team_name}</span>
                )}
              </td>
              <td className="text-osrs-parchment px-2 py-1.5 text-right tabular-nums">
                {formatGained(row.gained, metricKind)}
              </td>
              {hasBonuses && (
                <td className="text-osrs-parchment-dark/80 px-2 py-1.5 text-right tabular-nums">
                  {row.bonus_points > 0 ? `+${row.bonus_points.toLocaleString("en-US")}` : "—"}
                </td>
              )}
              {pointsMode && (
                <td className="text-osrs-gold-bright px-2 py-1.5 text-right font-medium tabular-nums">
                  {row.points.toLocaleString("en-US")}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-osrs-parchment-dark/50 mt-2 text-xs">
        {totals.participants} player{totals.participants === 1 ? "" : "s"} ·{" "}
        {formatGained(totals.gained, metricKind)} gained
        {standings.length > top.length ? ` · +${standings.length - top.length} more on the site` : ""}
        {competition.wom ? " · via WiseOldMan" : ""}
      </p>
    </div>
  );
}
