/**
 * BFF: one race participant's bonus-award log for the Discord Activity —
 * bearer-token twin of the site's competition player drill-in.
 */
import { NextResponse, type NextRequest } from "next/server";
import { CompetitionPlayerDetailSchema } from "@droptracker/api-types";
import { bearerFrom, rewriteImgUrls, upstreamGet, UpstreamError } from "../../../../../_lib";

type Ctx = { params: Promise<{ id: string; playerId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id, playerId } = await ctx.params;
  const eventId = Number(id);
  const pid = Number(playerId);
  if (!Number.isInteger(eventId) || eventId <= 0 || !Number.isInteger(pid)) {
    return NextResponse.json({ detail: "bad id" }, { status: 400 });
  }
  const bearer = bearerFrom(req);
  try {
    const detail = CompetitionPlayerDetailSchema.parse(
      await upstreamGet(`/events/${eventId}/competition/players/${pid}`, { bearer, revalidate: 10 }),
    );
    return NextResponse.json(rewriteImgUrls(detail), {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ detail: "Couldn't load the awards." }, { status: err.status });
    }
    console.error("[activity/events/:id/competition/players/:playerId]", err);
    return NextResponse.json({ detail: "Couldn't load the awards." }, { status: 502 });
  }
}
