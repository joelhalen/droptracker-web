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
type Search = Promise<{ k?: string }>;

export default async function RecapImagePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { scope, id, period } = await params;
  const { k } = await searchParams;
  const subjectId = Number(id);
  const token = env.boardImageToken;

  if (!token || !k || k !== token || !Number.isFinite(subjectId)) notFound();
  if (scope !== "group" && scope !== "player") notFound();

  const recap = await api.recap(scope, subjectId, period);
  if (!recap) notFound();

  return (
    <>
      {/* Drop the root layout's min-h-screen so the capture is exactly the
          card's height, and give it a solid dark backing — matches
          /board-image, and keeps the PNG free of transparent margins. */}
      <style>{`body{min-height:0!important;background:#0e1512}`}</style>
      <div style={{ width: WIDTH, padding: 24, boxSizing: "border-box" }}>
        <RecapCard recap={recap} />
      </div>
    </>
  );
}
