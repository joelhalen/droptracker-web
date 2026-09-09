import type { PbBossBoard } from "@droptracker/api-types";
import { BoardCard } from "@/components/pb-board-card";
import { EmptyState } from "@/components/ui";

/**
 * The per-team-size leaderboards for one boss. Shared by the global
 * /personal-bests/[npcId] page and the group "Personal bests" tab
 * (group-scoped boards additionally cite each entry's global rank). Each
 * board is a client card so a time can be expanded to the gear, inventory and
 * character model it was set with (see pb-board-card.tsx).
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
