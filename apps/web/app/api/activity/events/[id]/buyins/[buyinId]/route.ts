/**
 * BFF: update one buy-in from the Activity (web52a) — the paid tick and the
 * proof screenshot (web75a), both PATCH. Bearer twin of the site server
 * actions — the backend re-checks admin auth; this route only forwards, never
 * trusts the client.
 *
 * There is deliberately no DELETE: the Activity's pot panel has no remove
 * control (removal lives in the site's admin prize-pot manager), and an
 * unused write proxy is attack surface with nothing to show for it.
 */
import { NextResponse, type NextRequest } from "next/server";
import { bearerFrom, upstreamForward } from "@/app/api/activity/_lib";

type Ctx = { params: Promise<{ id: string; buyinId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id, buyinId } = await ctx.params;
  const eventId = Number(id);
  const bid = Number(buyinId);
  if (!Number.isInteger(eventId) || eventId <= 0 || !Number.isInteger(bid) || bid <= 0) {
    return NextResponse.json({ detail: "bad request" }, { status: 400 });
  }
  const bearer = bearerFrom(req);
  if (!bearer) {
    return NextResponse.json({ detail: "Sign in to manage the pot." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    const res = await upstreamForward("PATCH", `/events/${eventId}/buyins/${bid}`, bearer, body);
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch (err) {
    console.error("[activity/events/:id/buyins/:buyinId]", err);
    return NextResponse.json({ detail: "Couldn't reach the event service." }, { status: 502 });
  }
}
