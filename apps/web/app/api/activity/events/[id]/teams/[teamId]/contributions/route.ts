/**
 * BFF: one team's submission log for the Discord Activity (bearer twin of
 * `api.eventTeamContributions`). `page`/`limit` pass through; screenshot proof
 * URLs are rewritten to same-origin `/img` so the thumbnails render inside the
 * discordsays CSP (same shim the loot-sweep receipt cards rely on).
 */
import { NextResponse, type NextRequest } from "next/server";
import { EventTeamContributionsSchema } from "@droptracker/api-types";
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
  const sp = req.nextUrl.searchParams;
  const q = new URLSearchParams();
  for (const key of ["page", "limit"]) {
    const v = sp.get(key);
    const n = Number(v);
    if (v && Number.isInteger(n) && n > 0) q.set(key, String(n));
  }
  const bearer = bearerFrom(req);
  try {
    const data = await upstreamGet(`/events/${eventId}/teams/${tid}/contributions?${q}`, {
      bearer: bearer || undefined,
      revalidate: 15,
    });
    return NextResponse.json(rewriteImgUrls(EventTeamContributionsSchema.parse(data)));
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: `upstream ${err.status}` }, { status: err.status });
    }
    console.error("[activity/events/:id/teams/:teamId/contributions]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
