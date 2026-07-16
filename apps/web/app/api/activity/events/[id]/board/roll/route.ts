/**
 * BFF: board dice roll for the Discord Activity (bearer twin of the site's
 * `rollBoardAsMember`). Team membership, leadership gating and the manual-roll
 * rules are all enforced upstream; this route only translates the bearer.
 */
import { NextResponse, type NextRequest } from "next/server";
import { bearerFrom, upstreamForward } from "../../../../_lib";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ detail: "bad event id" }, { status: 400 });
  }
  const bearer = bearerFrom(req);
  if (!bearer) return NextResponse.json({ detail: "Sign in to roll." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const teamId = Number((body as { team_id?: unknown }).team_id);

  try {
    const res = await upstreamForward(
      "POST",
      `/events/${eventId}/board/roll`,
      bearer,
      Number.isInteger(teamId) && teamId > 0 ? { team_id: teamId } : {},
    );
    const out = await res.json().catch(() => ({}));
    return NextResponse.json(out, { status: res.status });
  } catch (err) {
    console.error("[activity/board/roll]", err);
    return NextResponse.json({ detail: "Couldn't reach the event service." }, { status: 502 });
  }
}
