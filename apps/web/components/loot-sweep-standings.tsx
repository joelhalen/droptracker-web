import type { LootSweepSummary } from "@droptracker/api-types";

/**
 * Compact Loot Sweep standings — the leaderboard the Discord board image
 * screenshots (services/event_board_image.py → /board-image/[id]). The full
 * per-item matrix (`loot-sweep-board.tsx`) is far too tall to fit a Discord
 * image for a game-wide sweep (event #27 = 49 sets × 320 items), so this is a
 * bounded, screenshot-sized standings table instead: rank, team, score, sets
 * completed, and each team's top-scoring bosses.
 *
 * Server-rendered and static (no SSE / interactivity) — it exists only to be
 * captured as a PNG. Fed by `api.eventLootSweepSummaryForRender`.
 */
// Rank badge colours for the podium (gold / silver / bronze). Emoji medals
// aren't used: the headless-chromium screenshot environment has no emoji font,
// so they'd render as tofu — a coloured badge is font-independent.
const RANK_BG = ["#f5c542", "#cbd5d9", "#cd7f32"];

// Cap the table so a huge-roster event still yields a bounded image; loot_sweep
// events are typically a handful of teams (clan-vs-clan tops out ~12).
const MAX_ROWS = 15;

export function LootSweepStandings({
  summary,
  highlightTeamId,
}: {
  summary: LootSweepSummary;
  highlightTeamId?: number | null;
}) {
  const { teams, sets_total, event_name, status } = summary;
  const statusLine = status === "past" ? "Final standings 🏁" : "Live";
  const rows = teams.slice(0, MAX_ROWS);

  return (
    <div className="text-osrs-parchment">
      <div className="border-osrs-bronze/25 mb-4 flex items-baseline justify-between border-b pb-3">
        <h1 className="text-osrs-gold text-2xl font-bold leading-tight">{event_name}</h1>
        <span className="text-osrs-parchment-dark/60 text-sm">
          {statusLine} · {sets_total} {sets_total === 1 ? "set" : "sets"}
        </span>
      </div>

      <div className="space-y-2">
        {rows.map((t) => {
          const mine = highlightTeamId != null && t.team_id === highlightTeamId;
          const pct = sets_total > 0 ? Math.round((t.sets_completed / sets_total) * 100) : 0;
          return (
            <div
              key={t.team_id}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                mine
                  ? "border-osrs-gold/60 bg-osrs-gold/10"
                  : "border-osrs-bronze/25 bg-osrs-brown-dark/30"
              }`}
            >
              <div className="flex w-9 shrink-0 justify-center">
                {t.rank <= 3 ? (
                  <span
                    className="text-osrs-brown-dark flex size-7 items-center justify-center rounded-full text-sm font-bold tabular-nums"
                    style={{ backgroundColor: RANK_BG[t.rank - 1] }}
                  >
                    {t.rank}
                  </span>
                ) : (
                  <span className="text-osrs-parchment-dark/60 text-lg font-semibold tabular-nums">
                    {t.rank}
                  </span>
                )}
              </div>

              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: t.color ?? "#8a8a8a" }}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span
                    className={`truncate text-lg font-semibold ${
                      mine ? "text-osrs-gold-bright" : "text-osrs-parchment"
                    }`}
                  >
                    {t.name}
                  </span>
                  <span className="text-osrs-parchment-dark/50 shrink-0 text-xs tabular-nums">
                    {t.sets_completed}/{sets_total} sets
                  </span>
                </div>

                <div className="bg-osrs-stone/30 mt-1.5 h-1.5 w-full overflow-hidden rounded">
                  <div
                    className="bg-osrs-gold h-full rounded"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {t.top_sets.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {t.top_sets.map((s, i) => (
                      <span
                        key={i}
                        className="text-osrs-parchment-dark/70 flex items-center gap-1 text-xs"
                      >
                        {s.npc_id != null && (
                          <img
                            src={`/img/npcdb/${s.npc_id}.png`}
                            alt=""
                            className="h-4 w-4 shrink-0 object-contain"
                          />
                        )}
                        <span className="max-w-[11rem] truncate">{s.label ?? "—"}</span>
                        <span className="text-osrs-gold-bright tabular-nums">
                          {s.points.toLocaleString()}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-osrs-gold shrink-0 text-2xl font-bold tabular-nums leading-none">
                {t.score.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      {teams.length > MAX_ROWS && (
        <p className="text-osrs-parchment-dark/40 mt-3 text-center text-xs">
          + {teams.length - MAX_ROWS} more teams
        </p>
      )}
    </div>
  );
}
