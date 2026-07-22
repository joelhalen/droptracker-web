/**
 * BFF: Teams-tab standings rollup for the Discord Activity — rank/score,
 * tasks-done, pot share, event-window loot GP, top task-credited items and
 * top contributors per team (mirror of the site's Teams tab data).
 */
import { NextResponse, type NextRequest } from "next/server";
import { EventTeamsResponseSchema } from "@droptracker/api-types";
import { bearerFrom, rewriteImgUrls, upstreamGet, UpstreamError } from "@/app/api/activity/_lib";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const bearer = bearerFrom(req);
  try {
    const data = await upstreamGet(`/events/${eventId}/teams`, {
      bearer: bearer || undefined,
      revalidate: 15,
    });
    return NextResponse.json(rewriteImgUrls(EventTeamsResponseSchema.parse(data)));
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: `upstream ${err.status}` }, { status: err.status });
    }
    console.error("[activity/events/:id/teams]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
