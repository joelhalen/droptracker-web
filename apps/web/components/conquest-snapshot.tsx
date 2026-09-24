"use client";

/**
 * Conquest map snapshot (web120a) for the chrome-less board-image render the
 * Discord bot screenshots: the map as the site draws it, with a compact
 * standings table under it. Static (no hover, no live updates).
 */
import type { ConquestMap } from "@droptracker/api-types";
import { ConquestMapCanvas } from "@/components/conquest-map";
import { NEUTRAL_COLOR, conquestTeamColors, fmtPoints, holdingText } from "@/lib/conquest";
import { TEAM_COLORS } from "@/lib/events";

export function ConquestSnapshot({
  map,
  highlightTeamId = null,
}: {
  map: ConquestMap;
  highlightTeamId?: number | null;
}) {
  const colors = conquestTeamColors(map.teams, TEAM_COLORS);
  const standings = [...map.teams]
    .sort((a, b) => b.live_score - a.live_score || b.tiles - a.tiles || a.id - b.id)
    .slice(0, 8);
  return (
    <div className="space-y-4">
      <ConquestMapCanvas
        tiles={map.tiles.map((t) => ({
          key: String(t.id),
          label: t.label,
          x: t.x,
          y: t.y,
          kind: t.kind,
          icon_npc_id: t.icon_npc_id,
          icon_item_id: t.icon_item_id,
          owner_team_id: t.owner_team_id,
          defense: t.defense,
          region_key: t.region_id != null ? String(t.region_id) : null,
        }))}
        regions={map.regions.map((r) => ({
          key: String(r.id),
          name: r.name,
          color: r.color,
          bonus: r.bonus,
          label_x: r.label_x,
          label_y: r.label_y,
          owner_team_id: r.owner_team_id,
        }))}
        edges={map.edges.map(([a, b]) => [String(a), String(b)] as [string, string])}
        background={
          map.background_url
            ? { url: map.background_url, width: map.bg_width ?? 1600, height: map.bg_height ?? 1000 }
            : null
        }
        colors={colors}
        maxDefense={map.settings.max_defense}
        viewerTeamId={highlightTeamId}
      />
      {standings.length > 0 && (
        <table className="w-full text-sm">
          <tbody>
            {standings.map((team, i) => (
              <tr
                key={team.id}
                className={`border-osrs-bronze/20 border-t ${
                  team.id === highlightTeamId ? "bg-osrs-gold/10" : ""
                }`}
              >
                <td className="text-osrs-parchment-dark/70 w-8 py-1.5 tabular-nums">{i + 1}</td>
                <td className="py-1.5">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block size-3 rounded-full"
                      style={{ background: colors.get(team.id) ?? NEUTRAL_COLOR }}
                    />
                    <span className="text-osrs-parchment font-medium">{team.name}</span>
                  </span>
                </td>
                <td className="text-osrs-parchment py-1.5 text-right font-semibold tabular-nums">
                  {fmtPoints(team.live_score)} pts
                </td>
                <td className="text-osrs-parchment-dark/70 py-1.5 text-right tabular-nums">
                  {team.tiles} tiles · {team.regions} regions
                </td>
                <td className="text-osrs-parchment-dark/60 py-1.5 text-right text-xs tabular-nums">
                  {holdingText(team, map.settings.scoring_mode)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
