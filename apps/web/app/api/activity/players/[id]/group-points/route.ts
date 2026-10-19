/**
 * BFF: a player's clan points for the Discord Activity profile. Passes the
 * session through (bearer → cookie): which clan is shown depends on who is
 * looking, and members-only boards are only quoted to members.
 */
import { NextResponse, type NextRequest } from "next/server";
import { PlayerGroupPointsSchema } from "@droptracker/api-types";
import { bearerFrom, upstreamGet, UpstreamError } from "../../../_lib";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const bearer = bearerFrom(req);
  try {
    const data = PlayerGroupPointsSchema.parse(
      await upstreamGet(`/players/${id}/group-points`, { bearer: bearer || undefined }),
    );
    return NextResponse.json(data, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: `upstream ${err.status}` }, { status: err.status });
    }
    console.error("[activity/players/:id/group-points]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
