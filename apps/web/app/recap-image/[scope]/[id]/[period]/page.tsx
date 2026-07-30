import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { env } from "@/lib/env";
import { RecapCard } from "@/components/recap-card";

/**
 * Chrome-less render of a recap card, sized for a 1:1 screenshot the Discord
 * embed points at (services/page_screenshot.py → services/recap_image.py).
 *
 * Mounts the SAME `RecapCard` the public page uses, so the posted image can
 * never drift from the page its link opens — the same guarantee
 * /board-image/[id] gives for event boards.
 *
 * Gated by `?k=<token>` matching BOARD_IMAGE_TOKEN. Unlike the board route this
 * needs no render bypass on the API side: a recap is public by construction, so
 * the token here only exists to keep an un-styled internal page from being
 * crawled or hotlinked.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

// CSS layout width; keep in sync with RECAP_IMAGE_WIDTH in
// services/recap_image.py.
const WIDTH = 1100;

type Params = Promise<{ scope: string; id: string; period: string }>;
// `w` and `layout` exist for previewing one period as both shapes (a narrow
// stacked poster for a Discord embed, the wide two-column one for the page).
// Both default to what production posts, so an un-parameterised URL is
// unchanged.
type Search = Promise<{ k?: string; w?: string; layout?: string }>;

export default async function RecapImagePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { scope, id, period } = await params;
  const { k, w, layout } = await searchParams;
  const subjectId = Number(id);
  const token = env.boardImageToken;

  if (!token || !k || k !== token || !Number.isFinite(subjectId)) notFound();
  if (scope !== "group" && scope !== "player") notFound();

  const requested = Number(w);
  const cardWidth =
    Number.isFinite(requested) && requested >= 480 && requested <= 2000 ? requested : WIDTH;
  const shape = layout === "stacked" || layout === "columns" ? layout : "auto";

  // `fresh`: this render becomes a stored PNG, so it must reflect the snapshot
  // as it is now, not as it was cached up to an hour ago.
  const recap = await api.recap(scope, subjectId, period, true);
  if (!recap) notFound();

  return (
    <>
      {/* Drop the root layout's min-h-screen (and its margins) so the capture is
          exactly the poster: the card's own stone frame is the image's border,
          edge to edge, with no page background showing anywhere. The backing
          colour only matters for the single sub-pixel row rounding can leave. */}
      <style>{`body{min-height:0!important;margin:0;background:#0b100d}`}</style>
      <div style={{ width: cardWidth }}>
        <RecapCard recap={recap} width={cardWidth} layout={shape} />
      </div>
    </>
  );
}
