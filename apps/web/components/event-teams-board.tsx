/**
 * Enhanced team standings for the Teams tab, driven by the self-sufficient
 * GET /events/{id}/teams rollup: a card per team with rank medal, accent
 * color, score, event-window loot GP, a tasks-done meter, the top items the
 * team pulled to earn points (icon strip), member/pot meta, board-game
 * coins/piece when present, and top contributors. Each card links to the full
 * per-team drill-down (roster, items, per-task progress, activity).
 *
 * Server component — a cached standings snapshot; the per-team page owns the
 * live SSE view. Kind-agnostic.
 */
import Link from "next/link";
import type { Route } from "next";
import type { EventTeamsResponse, EventTeamsRow } from "@droptracker/api-types";
import { Card, EmptyState, NameTile, RankMedal, StatTile } from "@/components/ui";
import { ItemDbIcon } from "@/components/item-db-icon";
import { teamColorMap } from "@/lib/events";

const num = (n: number) => n.toLocaleString();
const fmtPoints = (p: number) => (Math.round(p * 100) / 100).toLocaleString();
const gp = (m?: { value: number; value_formatted: string } | null) =>
  m?.value_formatted ?? "0";

function TasksMeter({ done, total, color }: { done: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div>
      <div className="text-osrs-parchment-dark/60 mb-1 flex justify-between text-xs">
        <span>Tasks completed</span>
        <span className="tabular-nums">
          {num(done)} / {num(total)}
        </span>
      </div>
      <div className="bg-osrs-brown-dark/60 h-2 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

/** Top task-credited items as an icon strip with ×qty badges. */
function TeamItemStrip({ items }: { items: EventTeamsRow["items"] }) {
  const withIcons = items.filter((i) => i.item_id != null);
  if (!withIcons.length) return null;
  return (
    <div className="mt-3 pl-2">
      <div className="text-osrs-parchment-dark/50 mb-1 text-[10px] font-semibold uppercase tracking-wide">
        Items earned
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {withIcons.map((it) => (
          <span
            key={it.name}
            className="bg-osrs-surface-2/40 relative rounded p-0.5"
            title={`${it.name}${it.quantity > 1 ? ` ×${num(it.quantity)}` : ""}`}
          >
            <ItemDbIcon itemId={it.item_id} size={24} />
            {it.quantity > 1 && (
              <span className="text-osrs-parchment-dark/80 absolute -bottom-1 -right-1 rounded bg-osrs-brown-dark/90 px-0.5 text-[9px] font-bold leading-tight">
                {it.quantity > 999 ? "999+" : it.quantity}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export function EventTeamsBoard({
  eventId,
  kind,
  data,
  taskCount,
  potEnabled,
  viewerTeamId,
  onOpenTeam,
  onOpenPlayer,
}: {
  eventId: number;
  kind?: string;
  data: EventTeamsResponse | null;
  taskCount: number;
  potEnabled?: boolean;
  viewerTeamId?: number | null;
  /** Discord Activity swaps links (which would 404 in the iframe) for in-app
   * view pushes; the site leaves these unset and renders real links. */
  onOpenTeam?: (teamId: number) => void;
  onOpenPlayer?: (playerId: number) => void;
}) {
  const teams = data?.teams ?? [];
  if (!teams.length) {
    return <EmptyState title="No teams yet" hint="Teams will appear here once the event has them." />;
  }

  // Stable per-team accent: assign the fallback palette in id order so a rank
  // change never recolors a team (matches the board/bingo palette behavior).
  const colorFor = teamColorMap([...teams].sort((a, b) => a.id - b.id));
  const ranked = [...teams].sort((a, b) => a.rank - b.rank);
  const totals = data?.totals;
  const isBoardGame = kind === "board_game";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Teams" value={totals?.teams ?? teams.length} />
        <StatTile label="Players" value={num(totals?.players ?? 0)} />
        <StatTile label="Loot tracked" value={gp(totals?.loot_gp)} hint="all sources, this event" />
        <StatTile
          label="Leader"
          value={<span className="truncate">{ranked[0]?.name ?? "—"}</span>}
          hint={ranked[0] ? `${num(ranked[0].score)} pts` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {ranked.map((team) => {
          const color = colorFor.get(team.id) ?? "#9aa3b0";
          const pot = potEnabled ? team.pot_total : undefined;
          const isViewer = viewerTeamId != null && viewerTeamId === team.id;
          return (
            <Card
              key={team.id}
              className={`relative overflow-hidden ${isViewer ? "ring-osrs-gold/40 ring-1" : ""}`}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-1"
                style={{ background: color }}
              />
              <div className="flex items-start gap-3 pl-2">
                <RankMedal rank={team.rank} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  {(() => {
                    const title = (
                      <>
                        {isBoardGame && team.piece_item_id != null ? (
                          <ItemDbIcon itemId={team.piece_item_id} size={18} />
                        ) : (
                          <span
                            aria-hidden
                            className="inline-block size-2.5 shrink-0 rounded-full"
                            style={{ background: color }}
                          />
                        )}
                        <span className="truncate">{team.name}</span>
                        {isViewer && (
                          <span className="bg-osrs-gold/20 text-osrs-gold-bright shrink-0 rounded px-1.5 text-[10px] font-bold uppercase">
                            Your team
                          </span>
                        )}
                      </>
                    );
                    return onOpenTeam ? (
                      <button
                        type="button"
                        onClick={() => onOpenTeam(team.id)}
                        className="hover:text-osrs-gold-bright flex w-full items-center gap-2 text-left font-semibold"
                      >
                        {title}
                      </button>
                    ) : (
                      <Link
                        href={`/events/${eventId}/teams/${team.id}` as Route}
                        className="hover:text-osrs-gold-bright flex items-center gap-2 font-semibold"
                      >
                        {title}
                      </Link>
                    );
                  })()}
                  <div className="text-osrs-parchment-dark/60 mt-0.5 text-xs">
                    {num(team.member_count)} players
                    {isBoardGame && <> · 🪙 {num(team.coins)} coins</>}
                    {pot && pot.value > 0 && <> · 💰 {pot.value_formatted}</>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-osrs-gold-bright text-xl font-bold tabular-nums">
                    {num(team.score)}
                  </div>
                  <div className="text-osrs-parchment-dark/40 text-[10px] uppercase">points</div>
                  <div className="text-osrs-gold mt-0.5 text-xs font-semibold tabular-nums">
                    {gp(team.loot_gp)}
                  </div>
                  <div className="text-osrs-parchment-dark/40 text-[10px] uppercase">loot</div>
                </div>
              </div>

              <div className="mt-3 pl-2">
                <TasksMeter done={team.tasks_done} total={taskCount} color={color} />
              </div>

              <TeamItemStrip items={team.items} />

              {team.top_contributors.length > 0 && (
                <div className="mt-3 pl-2">
                  <div className="text-osrs-parchment-dark/50 mb-1 text-[10px] font-semibold uppercase tracking-wide">
                    Top contributors
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {team.top_contributors.map((c, ci) =>
                      c.player_id != null ? (
                        onOpenPlayer ? (
                          <button
                            key={c.player_id}
                            type="button"
                            onClick={() => onOpenPlayer(c.player_id!)}
                            className="bg-osrs-surface-2/50 hover:bg-osrs-bronze/20 flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 text-xs"
                            title={`${c.player_name} · ${fmtPoints(c.points)} pts`}
                          >
                            <NameTile name={c.player_name} size="sm" />
                            <span className="text-osrs-parchment max-w-[7rem] truncate">
                              {c.player_name}
                            </span>
                            <span className="text-osrs-gold-bright shrink-0 font-semibold tabular-nums">
                              {fmtPoints(c.points)}
                            </span>
                          </button>
                        ) : (
                          <Link
                            key={c.player_id}
                            href={`/players/${c.player_id}` as Route}
                            className="bg-osrs-surface-2/50 hover:bg-osrs-bronze/20 flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 text-xs"
                            title={`${c.player_name} · ${fmtPoints(c.points)} pts`}
                          >
                            <NameTile name={c.player_name} size="sm" />
                            <span className="text-osrs-parchment max-w-[7rem] truncate">
                              {c.player_name}
                            </span>
                            <span className="text-osrs-gold-bright shrink-0 font-semibold tabular-nums">
                              {fmtPoints(c.points)}
                            </span>
                          </Link>
                        )
                      ) : (
                        <span
                          key={`hidden-${ci}`}
                          className="bg-osrs-surface-2/50 flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 text-xs"
                        >
                          <NameTile name={c.player_name} size="sm" />
                          <span className="text-osrs-parchment-dark/70">{c.player_name}</span>
                          <span className="text-osrs-gold-bright shrink-0 font-semibold tabular-nums">
                            {fmtPoints(c.points)}
                          </span>
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}

              <div className="mt-3 pl-2">
                {onOpenTeam ? (
                  <button
                    type="button"
                    onClick={() => onOpenTeam(team.id)}
                    className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-xs"
                  >
                    View team detail →
                  </button>
                ) : (
                  <Link
                    href={`/events/${eventId}/teams/${team.id}` as Route}
                    className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-xs"
                  >
                    View team detail →
                  </Link>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
