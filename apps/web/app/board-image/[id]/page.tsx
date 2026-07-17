import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { env } from "@/lib/env";
import { BingoBoard } from "@/components/bingo-board";
import { EventBoardView } from "@/components/event-board-view";

/**
 * Chrome-less render of an event's live board, sized for a 1:1 screenshot the
 * Discord bot posts (services/page_screenshot.py → services/event_board_image.py).
 * It mounts the SAME components the real event page uses — so the Discord image
 * always matches what players see on the site — in a fixed-width, static
 * (non-interactive, all-teams) layout.
 *
 * Gated by `?k=<token>` matching `BOARD_IMAGE_TOKEN`; the data is fetched with
 * the same token via the backend's internal render bypass, so private/draft
 * event boards render too. Never cached — always the current board state.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

// CSS layout width; keep in sync with services/event_board_image.BOARD_IMAGE_WIDTH.
const WIDTH = 1100;

type Params = Promise<{ id: string }>;
type Search = Promise<{ k?: string; team?: string }>;

export default async function BoardImagePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id } = await params;
  const { k, team } = await searchParams;
  const eventId = Number(id);
  const token = env.boardImageToken;

  // Constant-ish token gate — empty token disables the route entirely.
  if (!token || !k || k !== token || !Number.isFinite(eventId)) notFound();

  const event = await api.eventForRender(eventId, token).catch(() => null);
  if (!event) notFound();
  const board =
    event.kind === "board_game"
      ? await api.eventBoardForRender(eventId, token).catch(() => null)
      : null;

  // Only bingo / board-game events have a visual board; anything else (a plain
  // task-list event) has nothing to screenshot.
  if (!board && !event.bingo) notFound();

  const teams = event.teams.map((t) => ({ id: t.id, name: t.name, color: t.color }));
  // Team-scoped render (web54a): the per-team Discord channel posts screenshot
  // the board with that team's tab pre-selected (bingo) / piece highlighted
  // (board game). Unknown ids fall back to the all-teams view.
  const teamId = Number(team);
  const selectedTeam =
    Number.isFinite(teamId) && teams.some((t) => t.id === teamId) ? teamId : null;

  return (
    <>
      {/* Drop the root layout's min-h-screen so the captured page is exactly the
          board's height (a tight image), and give it a solid dark backing. */}
      <style>{`body{min-height:0!important;background:#0e1512}`}</style>
      <div style={{ width: WIDTH, padding: 20, boxSizing: "border-box" }}>
        {board && (
          <EventBoardView
            event={event}
            initialBoard={board}
            viewerTeamId={selectedTeam}
            leadership={event.leadership}
            viewerRole={null}
          />
        )}
        {event.bingo && (
          <BingoBoard
            board={event.bingo}
            teams={teams}
            tasks={event.tasks}
            eventId={event.id}
            live={false}
            progress={event.progress}
            viewerTeamId={selectedTeam}
            initialSelectedTeam={selectedTeam}
          />
        )}
      </div>
    </>
  );
}
