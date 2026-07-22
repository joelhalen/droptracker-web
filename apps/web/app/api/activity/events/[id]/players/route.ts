/**
 * BFF: event-wide player contribution leaderboard for the Discord Activity
 * (mirror of the site's Players tab data). Bearer → dt_session cookie so
 * draft visibility matches the viewer; icons rewritten for the iframe CSP.
 */
import { NextResponse, type NextRequest } from "next/server";
import { EventPlayersResponseSchema } from "@droptracker/api-types";
import { bearerFrom, rewriteImgUrls, upstreamGet, UpstreamError } from "@/app/api/activity/_lib";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const bearer = bearerFrom(req);
  try {
    const data = await upstreamGet(`/events/${eventId}/players`, {
      bearer: bearer || undefined,
      revalidate: 15,
    });
    return NextResponse.json(rewriteImgUrls(EventPlayersResponseSchema.parse(data)));
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: `upstream ${err.status}` }, { status: err.status });
    }
    console.error("[activity/events/:id/players]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
