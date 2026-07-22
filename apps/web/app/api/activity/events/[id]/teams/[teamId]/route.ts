/**
 * BFF: full team detail for the Discord Activity — standings context, roster
 * with contribution stats + loot GP, aggregated items, per-task progress and
 * the applied-ledger activity feed (mirror of the site's team page data).
 */
import { NextResponse, type NextRequest } from "next/server";
import { EventTeamDetailSchema } from "@droptracker/api-types";
import { bearerFrom, rewriteImgUrls, upstreamGet, UpstreamError } from "@/app/api/activity/_lib";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; teamId: string }> },
) {
  const { id, teamId } = await ctx.params;
  const eventId = Number(id);
  const tid = Number(teamId);
  if (!Number.isInteger(eventId) || eventId <= 0 || !Number.isInteger(tid) || tid <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const bearer = bearerFrom(req);
  try {
    const data = await upstreamGet(`/events/${eventId}/teams/${tid}`, {
      bearer: bearer || undefined,
      revalidate: 15,
    });
    return NextResponse.json(rewriteImgUrls(EventTeamDetailSchema.parse(data)));
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: `upstream ${err.status}` }, { status: err.status });
    }
    console.error("[activity/events/:id/teams/:teamId]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
