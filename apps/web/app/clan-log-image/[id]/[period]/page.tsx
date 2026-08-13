import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { env } from "@/lib/env";
import { ClanLogCard } from "@/components/clan-log-card";

/**
 * Chrome-less render of the Clan Log summary card, for the PNG the Discord
 * message carries (services/page_screenshot.py → services/clan_log_image.py).
 *
 * Mounts the same `ClanLogCard` nothing else on the site renders — the card is
 * the Discord artifact, and the interactive grid at /groups/{id}/log is the
 * thing its button links to. Keeping them separate is deliberate: the full grid
 * is taller than the screenshotter's 8000px ceiling.
 *
 * Gated by `?k=<token>` matching BOARD_IMAGE_TOKEN, like /board-image and
 * /recap-image. The board is public, so the token only keeps an un-styled
 * internal page from being crawled.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

// CSS layout width; keep in sync with CLAN_LOG_IMAGE_WIDTH in
// services/clan_log_image.py.
const WIDTH = 1100;

type Params = Promise<{ id: string; period: string }>;
type Search = Promise<{ k?: string; w?: string }>;

export default async function ClanLogImagePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id, period } = await params;
  const { k, w } = await searchParams;
  const groupId = Number(id);
  const token = env.boardImageToken;

  if (!token || !k || k !== token || !Number.isFinite(groupId)) notFound();

  const requested = Number(w);
  const cardWidth =
    Number.isFinite(requested) && requested >= 480 && requested <= 2000 ? requested : WIDTH;

  // `fresh`: this render becomes a posted PNG, so it must reflect the board as
  // it is now rather than a cached copy up to five minutes old.
  const board = await api.clanLog(groupId, period, true);
  if (!board) notFound();

  return (
    <>
      {/* Drop the root layout's min-h-screen so the capture is exactly the card,
          edge to edge, with no page background showing. */}
      <style>{`body{min-height:0!important;margin:0;background:#0b100d}`}</style>
      <div style={{ width: cardWidth }}>
        <ClanLogCard board={board} width={cardWidth} />
      </div>
    </>
  );
}
