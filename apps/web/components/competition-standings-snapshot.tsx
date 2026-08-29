/** Static SOTW/BOTW standings table for the Discord board image (web105a) —
 * the chrome-less snapshot services/event_board_image.py screenshots. Top 10,
 * fixed width, no interactivity. Mirrors the live table's numbers exactly
 * (same fold, same formatting) so the Discord picture never disagrees with
 * the site. */

import type { EventCompetitionBoard } from "@droptracker/api-types";
import { formatGained, metricSummary } from "@/lib/competition";

export function CompetitionStandingsSnapshot({ board }: { board: EventCompetitionBoard }) {
  const { competition, standings, totals } = board;
  const metricKind = competition.metric.kind;
  const pointsMode = competition.ranking.mode === "points";
  const hasBonuses = competition.bonus_rules.length > 0;
  const top = standings.slice(0, 10);
  const summary = metricSummary(competition);
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="border-osrs-bronze/40 bg-osrs-brown-dark/40 rounded border p-4">
      {summary && <p className="text-osrs-parchment-dark/80 mb-2 text-sm">⚔️ {summary}</p>}
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
                {row.rank <= 3 ? medals[row.rank - 1] : (
                  <span className="text-osrs-parchment-dark/70 tabular-nums">{row.rank}</span>
                )}
              </td>
              <td className="text-osrs-parchment px-2 py-1.5">{row.player_name}</td>
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
