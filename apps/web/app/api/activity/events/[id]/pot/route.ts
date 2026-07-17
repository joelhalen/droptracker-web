/**
 * BFF: prize-pot read for the Discord Activity (web52a). Bearer→dt_session, and
 * `rewriteImgUrls` in case any contributor payload carries absolute icon URLs.
 */
import { NextResponse, type NextRequest } from "next/server";
import { EventPrizePotSchema } from "@droptracker/api-types";
import { bearerFrom, rewriteImgUrls, upstreamGet, UpstreamError } from "@/app/api/activity/_lib";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "bad event id" }, { status: 400 });
  }
  const bearer = bearerFrom(req);
  try {
    const raw = await upstreamGet(`/events/${eventId}/pot`, {
      bearer: bearer || undefined,
      revalidate: 15,
    });
    return NextResponse.json(EventPrizePotSchema.parse(rewriteImgUrls(raw)));
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: "upstream error" }, { status: err.status === 404 ? 404 : 502 });
    }
    console.error("[activity/events/:id/pot]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
