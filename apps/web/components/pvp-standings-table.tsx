/**
 * A PvP board: loot taken, kills, deaths and K/D per player, ranked by one of
 * them. Server-safe snapshot (PvP standings have no live SSE deltas).
 */
import type { PvpLeaderboardEntry, PvpMetric } from "@droptracker/api-types";
import { entityPath } from "@/lib/slug";
import { EmptyState, EntityChip, RankMedal } from "@/components/ui";

function kdText(kd: number | null): string {
  return kd == null ? "-" : kd.toFixed(2);
}

export function PvpStandingsTable({
  entries,
  metric,
}: {
  entries: PvpLeaderboardEntry[];
  metric: PvpMetric;
}) {
  if (!entries.length) {
    return (
      <EmptyState
        title="No PvP standings yet"
        hint="The board fills in as members running the plugin kill other players for loot. Kills in LMS and other PvP minigames don't count."
        icon="⚔"
      />
    );
  }
  const head = (key: PvpMetric, label: string) => (
    <th className={`px-3 py-2 text-right whitespace-nowrap ${metric === key ? "text-osrs-gold-bright" : ""}`}>
      {label}
    </th>
  );
  return (
    <div className="border-osrs-bronze/20 overflow-x-auto rounded border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-osrs-gold/80 text-left">
            <th className="w-12 px-3 py-2">#</th>
            <th className="w-full px-3 py-2">Name</th>
            {head("loot", "Loot")}
            {head("kills", "Kills")}
            {head("deaths", "Deaths")}
            <th className="px-3 py-2 text-right">K/D</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((r) => (
            <tr key={r.id} className="border-osrs-bronze/20 border-t">
              <td className="px-3 py-2">
                <RankMedal rank={r.rank} />
              </td>
              <td className="w-full max-w-0 px-3 py-2">
                <EntityChip
                  href={entityPath("players", r.id, r.name)}
                  name={r.name}
                  size="sm"
                  className="shrink-0"
                  tileClassName="max-sm:hidden"
                  playerId={r.id}
                />
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                {r.loot.value_formatted}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{r.kills.toLocaleString()}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.deaths.toLocaleString()}</td>
              <td className="text-osrs-parchment-dark/80 px-3 py-2 text-right tabular-nums">
                {kdText(r.kd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
