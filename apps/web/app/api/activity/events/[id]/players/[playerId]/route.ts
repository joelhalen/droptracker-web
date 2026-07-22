/**
 * BFF: one player's event contribution drill-down for the Discord Activity
 * (items + per-task + activity + event-window loot GP).
 */
import { NextResponse, type NextRequest } from "next/server";
import { EventPlayerDetailSchema } from "@droptracker/api-types";
import { bearerFrom, rewriteImgUrls, upstreamGet, UpstreamError } from "@/app/api/activity/_lib";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; playerId: string }> },
) {
  const { id, playerId } = await ctx.params;
  const eventId = Number(id);
  const pid = Number(playerId);
  if (!Number.isInteger(eventId) || eventId <= 0 || !Number.isInteger(pid) || pid <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const bearer = bearerFrom(req);
  try {
    const data = await upstreamGet(`/events/${eventId}/players/${pid}`, {
      bearer: bearer || undefined,
      revalidate: 15,
    });
    return NextResponse.json(rewriteImgUrls(EventPlayerDetailSchema.parse(data)));
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: `upstream ${err.status}` }, { status: err.status });
    }
    console.error("[activity/events/:id/players/:playerId]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
