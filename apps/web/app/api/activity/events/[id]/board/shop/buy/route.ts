/**
 * BFF: buy a board power-up for the Discord Activity (bearer twin of
 * `api.buyEventBoardItem`). Coins, ownership and stock caps enforced upstream.
 */
import { NextResponse, type NextRequest } from "next/server";
import { bearerFrom, upstreamForward } from "../../../../../_lib";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ detail: "bad event id" }, { status: 400 });
  }
  const bearer = bearerFrom(req);
  if (!bearer) return NextResponse.json({ detail: "Sign in to buy." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    shop_item_id?: unknown;
    team_id?: unknown;
  };
  const shopItemId = Number(body.shop_item_id);
  if (!Number.isInteger(shopItemId) || shopItemId <= 0) {
    return NextResponse.json({ detail: "Invalid item." }, { status: 400 });
  }
  const teamId = Number(body.team_id);

  try {
    const res = await upstreamForward("POST", `/events/${eventId}/board/shop/buy`, bearer, {
      shop_item_id: shopItemId,
      ...(Number.isInteger(teamId) && teamId > 0 ? { team_id: teamId } : {}),
    });
    const out = await res.json().catch(() => ({}));
    return NextResponse.json(out, { status: res.status });
  } catch (err) {
    console.error("[activity/board/buy]", err);
    return NextResponse.json({ detail: "Couldn't reach the event service." }, { status: 502 });
  }
}
