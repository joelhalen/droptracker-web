/**
 * BFF: a group's points leaderboard for the Discord Activity. Passes the
 * session through (bearer → cookie) because a clan can make its board
 * members-only, exactly as the site's authed read does.
 */
import { NextResponse, type NextRequest } from "next/server";
import { PointsLeaderboardSchema } from "@droptracker/api-types";
import { bearerFrom, rewriteImgUrls, upstreamGet, UpstreamError } from "../../../_lib";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const sp = req.nextUrl.searchParams;
  const q = new URLSearchParams({ limit: "50" });
  const period = (sp.get("period") ?? "").trim();
  if (/^(all|month|week|day|season:\d{1,9})$/.test(period)) q.set("period", period);
  const page = (sp.get("page") ?? "").trim();
  if (/^\d{1,4}$/.test(page)) q.set("page", page);
  const search = (sp.get("q") ?? "").trim().slice(0, 64);
  if (search) q.set("q", search);
  const bearer = bearerFrom(req);
  try {
    const board = PointsLeaderboardSchema.parse(
      await upstreamGet(`/groups/${id}/points/leaderboard?${q}`, { bearer: bearer || undefined }),
    );
    return NextResponse.json(rewriteImgUrls(board));
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: `upstream ${err.status}` }, { status: err.status });
    }
    console.error("[activity/groups/:id/points]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
