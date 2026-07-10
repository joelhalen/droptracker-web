import type { Route } from "next";
import Link from "next/link";
import type { PbBossBoard, PbTeamBoard } from "@droptracker/api-types";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { Badge, Card, EmptyState, RankMedal } from "@/components/ui";
import { formatRelativeTime } from "@/lib/format";

/** Records set in the last 7 days get a "New" badge (matches RecordsShowcase). */
const NEW_RECORD_WINDOW_S = 7 * 24 * 3600;

function BoardCard({ board, isGroupScoped }: { board: PbTeamBoard; isGroupScoped: boolean }) {
  const now = Math.floor(Date.now() / 1000);
  return (
    <Card padding="p-4" className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-osrs-gold font-semibold">{board.size_label}</h3>
        <span className="text-osrs-parchment-dark/60 shrink-0 text-xs">
          {board.total_players.toLocaleString()} ranked
        </span>
      </div>
      <ol className="space-y-1">
        {board.entries.map((e) => {
          const isNew = e.date_ts != null && e.date_ts > 0 && now - e.date_ts < NEW_RECORD_WINDOW_S;
          return (
            <li
              key={e.player_id}
              className={`flex items-center gap-2.5 rounded px-2 py-1.5 ${
                e.rank === 1 ? "bg-osrs-gold/10" : e.rank <= 3 ? "bg-osrs-surface-2/50" : ""
              }`}
            >
              <RankMedal rank={e.rank} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <EntityHoverCard
                    kind="player"
                    id={e.player_id}
                    name={e.player_name}
                    className="min-w-0 truncate"
                  >
                    <Link
                      href={`/players/${e.player_id}` as Route}
                      className="hover:text-osrs-gold-bright truncate text-sm font-medium transition-colors"
                    >
                      {e.player_name}
                    </Link>
                  </EntityHoverCard>
                  {isNew && <Badge tone="gold">New</Badge>}
                </span>
                <span className="text-osrs-parchment-dark/50 block truncate text-[11px]">
                  {isGroupScoped && e.global_rank != null && (
                    <span title="Position on the global board">Global #{e.global_rank}</span>
                  )}
                  {isGroupScoped && e.global_rank != null && e.date_ts != null && e.date_ts > 0 && " · "}
                  {e.date_ts != null && e.date_ts > 0 && formatRelativeTime(e.date_ts)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span
                  className={`font-mono text-sm font-bold tabular-nums ${
                    e.rank === 1 ? "text-osrs-gold-bright" : "text-osrs-parchment"
                  }`}
                >
                  {e.time_display}
                </span>
                {e.image_url && (
                  <a
                    href={e.image_url}
                    target="_blank"
                    rel="noreferrer"
                    title="View proof screenshot"
                    aria-label="View proof screenshot"
                    className="text-osrs-parchment-dark/40 hover:text-osrs-gold-bright text-xs transition-colors"
                  >
                    📷
                  </a>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/**
 * The per-team-size leaderboards for one boss. Shared by the global
 * /personal-bests/[npcId] page and the group "Personal bests" tab
 * (group-scoped boards additionally cite each entry's global rank).
 */
export function PbBoards({ board }: { board: PbBossBoard }) {
  const isGroupScoped = board.group_id != null;
  if (board.boards.length === 0) {
    return (
      <EmptyState
        title="No ranked times"
        hint="Personal bests appear here once members submit kill times with the plugin."
      />
    );
  }
  return (
    <div className="stagger-children grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      {board.boards.map((b) => (
        <BoardCard key={b.team_size} board={b} isGroupScoped={isGroupScoped} />
      ))}
    </div>
  );
}
