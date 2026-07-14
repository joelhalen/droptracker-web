/**
 * BFF: event leave for the Discord Activity — see the sibling join route for
 * the bearer→cookie translation rationale.
 */
import { NextResponse, type NextRequest } from "next/server";
import { EventMemberInputSchema } from "@droptracker/api-types";
import { env, SESSION_COOKIE } from "@/lib/env";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "bad event id" }, { status: 400 });
  }
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) {
    return NextResponse.json({ detail: "Sign in to leave an event." }, { status: 401 });
  }

  let input: unknown;
  try {
    input = EventMemberInputSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ detail: "Invalid request." }, { status: 400 });
  }

  try {
    const res = await fetch(`${env.webApiInternalUrl}/api/v1/events/${eventId}/leave`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        cookie: `${SESSION_COOKIE}=${bearer}`,
      },
      body: JSON.stringify(input),
    });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(body, { status: res.status });
  } catch (err) {
    console.error("[activity/leave]", err);
    return NextResponse.json({ detail: "Couldn't reach the event service." }, { status: 502 });
  }
}
