/**
 * BFF: use an owned board power-up for the Discord Activity (bearer twin of
 * `api.useEventBoardItem`). Cooldowns, targeting rules and shield/ward absorb
 * are all enforced upstream; this route forwards the value/target params.
 */
import { NextResponse, type NextRequest } from "next/server";
import { bearerFrom, upstreamForward } from "../../../../../../_lib";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; inventoryId: string }> },
) {
  const { id, inventoryId } = await ctx.params;
  const eventId = Number(id);
  const invId = Number(inventoryId);
  if (!Number.isInteger(eventId) || eventId <= 0 || !Number.isInteger(invId) || invId <= 0) {
    return NextResponse.json({ detail: "bad request" }, { status: 400 });
  }
  const bearer = bearerFrom(req);
  if (!bearer) return NextResponse.json({ detail: "Sign in to use items." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    team_id?: unknown;
    target_team_id?: unknown;
    target_tile_idx?: unknown;
    value?: unknown;
  };
  const num = (v: unknown): number | undefined => {
    const n = Number(v);
    return Number.isInteger(n) ? n : undefined;
  };
  const payload: Record<string, number> = {};
  const teamId = num(body.team_id);
  const targetTeamId = num(body.target_team_id);
  const targetTileIdx = num(body.target_tile_idx);
  const value = num(body.value);
  if (teamId != null && teamId > 0) payload.team_id = teamId;
  if (targetTeamId != null && targetTeamId > 0) payload.target_team_id = targetTeamId;
  if (targetTileIdx != null) payload.target_tile_idx = targetTileIdx;
  if (value != null) payload.value = value;

  try {
    const res = await upstreamForward(
      "POST",
      `/events/${eventId}/board/items/${invId}/use`,
      bearer,
      payload,
    );
    const out = await res.json().catch(() => ({}));
    return NextResponse.json(out, { status: res.status });
  } catch (err) {
    console.error("[activity/board/use]", err);
    return NextResponse.json({ detail: "Couldn't reach the event service." }, { status: 502 });
  }
}
