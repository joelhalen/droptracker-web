/**
 * BFF: troops raised per team and player for the Discord Activity's Conquest
 * view (the "Troops raised" board).
 */
import { NextResponse, type NextRequest } from "next/server";
import { ConquestTroopBoardSchema } from "@droptracker/api-types";
import { bearerFrom, rewriteImgUrls, upstreamGet, UpstreamError } from "@/app/api/activity/_lib";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "bad event id" }, { status: 400 });
  }
  const bearer = bearerFrom(req);
  try {
    const board = ConquestTroopBoardSchema.parse(
      await upstreamGet(`/events/${eventId}/conquest/troops`, { bearer: bearer || undefined, revalidate: 5 }),
    );
    return NextResponse.json(rewriteImgUrls(board));
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: `upstream ${err.status}` }, { status: err.status });
    }
    console.error("[activity/events/:id/conquest/troops]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
