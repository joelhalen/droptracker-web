/**
 * BFF: the SOTW/BOTW race board for the Discord Activity — bearer-token twin
 * of the site's `/api/events/[id]/competition` (standings, and the ranked
 * teams on a team race). Restricted-event visibility is enforced upstream.
 */
import { NextResponse, type NextRequest } from "next/server";
import { EventCompetitionBoardSchema } from "@droptracker/api-types";
import { bearerFrom, rewriteImgUrls, upstreamGet, UpstreamError } from "../../../_lib";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ detail: "bad event id" }, { status: 400 });
  }
  const bearer = bearerFrom(req);
  try {
    const board = EventCompetitionBoardSchema.parse(
      await upstreamGet(`/events/${eventId}/competition`, { bearer, revalidate: 10 }),
    );
    return NextResponse.json(rewriteImgUrls(board), {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ detail: "Couldn't load the race." }, { status: err.status });
    }
    console.error("[activity/events/:id/competition]", err);
    return NextResponse.json({ detail: "Couldn't load the race." }, { status: 502 });
  }
}
