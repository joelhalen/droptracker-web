/**
 * BFF: record a buy-in / donation from the Activity (web52a). Bearer twin of
 * the site server action — admin auth + validation live upstream; this only
 * translates the bearer into the session cookie and passes the problem body
 * (and status) through.
 */
import { NextResponse, type NextRequest } from "next/server";
import { bearerFrom, upstreamForward } from "@/app/api/activity/_lib";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ detail: "bad request" }, { status: 400 });
  }
  const bearer = bearerFrom(req);
  if (!bearer) {
    return NextResponse.json({ detail: "Sign in to manage the pot." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    const res = await upstreamForward("POST", `/events/${eventId}/buyins`, bearer, body);
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch (err) {
    console.error("[activity/events/:id/buyins]", err);
    return NextResponse.json({ detail: "Couldn't reach the event service." }, { status: 502 });
  }
}
