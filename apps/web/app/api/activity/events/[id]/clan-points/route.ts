/**
 * BFF: clan-point awards read for the Discord Activity (web114a) — the bearer
 * twin of the site's `api.eventClanPoints`. Public offer + paid recipients;
 * no admin preview (the Activity has no clan-points manager).
 */
import { NextResponse, type NextRequest } from "next/server";
import { EventClanPointsSchema } from "@droptracker/api-types";
import { bearerFrom, upstreamGet, UpstreamError } from "@/app/api/activity/_lib";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "bad event id" }, { status: 400 });
  }
  const bearer = bearerFrom(req);
  try {
    const raw = await upstreamGet(`/events/${eventId}/clan-points`, {
      bearer: bearer || undefined,
      revalidate: 15,
    });
    return NextResponse.json(EventClanPointsSchema.parse(raw));
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: "upstream error" }, { status: err.status === 404 ? 404 : 502 });
    }
    console.error("[activity/events/:id/clan-points]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
