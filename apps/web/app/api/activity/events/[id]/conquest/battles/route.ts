/**
 * BFF: older Conquest battle-log rows for the Discord Activity ("Show more").
 */
import { NextResponse, type NextRequest } from "next/server";
import { ConquestBattlesPageSchema } from "@droptracker/api-types";
import { bearerFrom, rewriteImgUrls, upstreamGet, UpstreamError } from "@/app/api/activity/_lib";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "bad event id" }, { status: 400 });
  }
  const q = new URLSearchParams({ limit: "30" });
  const before = req.nextUrl.searchParams.get("before") ?? "";
  if (/^\d+$/.test(before)) q.set("before", before);
  const bearer = bearerFrom(req);
  try {
    const page = ConquestBattlesPageSchema.parse(
      await upstreamGet(`/events/${eventId}/conquest/battles?${q}`, { bearer: bearer || undefined }),
    );
    return NextResponse.json(rewriteImgUrls(page));
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: `upstream ${err.status}` }, { status: err.status });
    }
    console.error("[activity/events/:id/conquest/battles]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
