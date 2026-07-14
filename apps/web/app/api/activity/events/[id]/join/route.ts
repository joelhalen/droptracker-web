/**
 * BFF: event join for the Discord Activity (bearer-token twin of the site's
 * cookie-based server action). Ownership, eligibility, formation-mode and
 * join-code rules are all enforced upstream by the Web API — this route only
 * translates the bearer header into the dt_session cookie and passes the
 * RFC-7807 problem detail through so the panel can show real error messages.
 */
import { NextResponse, type NextRequest } from "next/server";
import { EventJoinInputSchema } from "@droptracker/api-types";
import { env, SESSION_COOKIE } from "@/lib/env";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "bad event id" }, { status: 400 });
  }
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) {
    return NextResponse.json({ detail: "Sign in to join an event." }, { status: 401 });
  }

  let input: unknown;
  try {
    input = EventJoinInputSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ detail: "Invalid join request." }, { status: 400 });
  }

  try {
    const res = await fetch(`${env.webApiInternalUrl}/api/v1/events/${eventId}/join`, {
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
    console.error("[activity/join]", err);
    return NextResponse.json({ detail: "Couldn't reach the event service." }, { status: 502 });
  }
}
