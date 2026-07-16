/**
 * BFF: board power-up shop + the viewer team's wallet/inventory for the Discord
 * Activity (bearer twin of `api.eventBoardShop`). Requires a session upstream.
 * Item icons are numeric (itemdb) so they render via same-origin /img — only a
 * defensive img rewrite is applied.
 */
import { NextResponse, type NextRequest } from "next/server";
import { BoardShopStateSchema } from "@droptracker/api-types";
import { bearerFrom, rewriteImgUrls, UpstreamError, upstreamGet } from "../../../../_lib";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "bad event id" }, { status: 400 });
  }
  const bearer = bearerFrom(req);
  if (!bearer) return NextResponse.json({ detail: "Sign in to browse the shop." }, { status: 401 });

  const teamId = Number(req.nextUrl.searchParams.get("team_id"));
  const qs = Number.isInteger(teamId) && teamId > 0 ? `?team_id=${teamId}` : "";

  try {
    const data = await upstreamGet(`/events/${eventId}/board/shop${qs}`, { bearer });
    return NextResponse.json(rewriteImgUrls(BoardShopStateSchema.parse(data)));
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ detail: "Couldn't load the shop." }, { status: err.status });
    }
    console.error("[activity/board/shop]", err);
    return NextResponse.json({ detail: "Couldn't reach the event service." }, { status: 502 });
  }
}
