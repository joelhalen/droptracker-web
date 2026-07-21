/**
 * Enhanced team standings for the Teams tab: a card per team with rank medal,
 * accent color, score, a tasks-done meter, member/pot meta, and each team's
 * top contributors (from the event-wide players rollup). Each card links to the
 * full per-team drill-down (roster, per-task progress, activity).
 *
 * Server component — a cached standings snapshot; the per-team page owns the
 * live SSE view.
 */
import Link from "next/link";
import type { Route } from "next";
import type { EventTeam, EventProgress, EventPlayerRow, Money } from "@droptracker/api-types";
import { Card, EmptyState, NameTile, RankMedal, StatTile } from "@/components/ui";
import { teamColorMap } from "@/lib/events";

const num = (n: number) => n.toLocaleString();
const fmtPoints = (p: number) => (Math.round(p * 100) / 100).toLocaleString();

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

export function EventTeamsBoard({
  eventId,
  teams,
  progress,
  taskCount,
  players,
  potEnabled,
  viewerTeamId,
}: {
  eventId: number;
  teams: EventTeam[];
  progress?: EventProgress[];
  taskCount: number;
  players: EventPlayerRow[];
  potEnabled?: boolean;
  viewerTeamId?: number | null;
}) {
  if (!teams.length) {
    return <EmptyState title="No teams yet" hint="Teams will appear here once the event has them." />;
  }

  // Stable per-team accent from the UNSORTED roster (matches the board/bingo palette).
  const colorFor = teamColorMap(teams);
  const ranked = [...teams].sort((a, b) => b.score - a.score);

  // Top contributors per team from the event-wide players rollup.
  const contributorsByTeam = new Map<number, EventPlayerRow[]>();
  for (const p of players) {
    // Skip privacy-masked (hidden) contributors — they carry no linkable id.
    if (p.team_id == null || p.player_id == null) continue;
    const list = contributorsByTeam.get(p.team_id) ?? [];
    list.push(p);
    contributorsByTeam.set(p.team_id, list);
  }
  for (const list of contributorsByTeam.values()) {
    list.sort((a, b) => b.points - a.points || b.completions - a.completions);
  }

  const doneByTeam = new Map<number, number>();
  for (const pr of progress ?? []) {
    if (pr.completed) doneByTeam.set(pr.team_id, (doneByTeam.get(pr.team_id) ?? 0) + 1);
  }

  const totalMembers = teams.reduce((n, t) => n + (t.member_count ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Teams" value={teams.length} />
        <StatTile label="Players" value={num(totalMembers)} />
        <StatTile
          label="Leader"
          value={<span className="truncate">{ranked[0]?.name ?? "—"}</span>}
          hint={ranked[0] ? `${num(ranked[0].score)} pts` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {ranked.map((team, i) => {
          const color = colorFor.get(team.id) ?? "#9aa3b0";
          const done = doneByTeam.get(team.id) ?? 0;
          const top = (contributorsByTeam.get(team.id) ?? []).slice(0, 3);
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
                <RankMedal rank={i + 1} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/events/${eventId}/teams/${team.id}` as Route}
                    className="hover:text-osrs-gold-bright flex items-center gap-2 font-semibold"
                  >
                    <span
                      aria-hidden
                      className="inline-block size-2.5 shrink-0 rounded-full"
                      style={{ background: color }}
                    />
                    <span className="truncate">{team.name}</span>
                    {isViewer && (
                      <span className="bg-osrs-gold/20 text-osrs-gold-bright shrink-0 rounded px-1.5 text-[10px] font-bold uppercase">
                        Your team
                      </span>
                    )}
                  </Link>
                  <div className="text-osrs-parchment-dark/60 mt-0.5 text-xs">
                    {num(team.member_count ?? 0)} players
                    {pot && (pot as Money).value > 0 && (
                      <> · 💰 {(pot as Money).value_formatted}</>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-osrs-gold-bright text-xl font-bold tabular-nums">
                    {num(team.score)}
                  </div>
                  <div className="text-osrs-parchment-dark/40 text-[10px] uppercase">points</div>
                </div>
              </div>

              <div className="mt-3 pl-2">
                <TasksMeter done={done} total={taskCount} color={color} />
              </div>

              {top.length > 0 && (
                <div className="mt-3 pl-2">
                  <div className="text-osrs-parchment-dark/50 mb-1 text-[10px] font-semibold uppercase tracking-wide">
                    Top contributors
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {top.map((c) => (
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
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 pl-2">
                <Link
                  href={`/events/${eventId}/teams/${team.id}` as Route}
                  className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-xs"
                >
                  View team detail →
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
