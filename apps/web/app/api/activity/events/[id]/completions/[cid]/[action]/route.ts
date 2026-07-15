/**
 * BFF: confirm / reject one pending completion from the Activity's review
 * screen (bearer-token twin of the site's server actions). Admin auth, the
 * pending-only guard and audit logging all live upstream — this route only
 * translates the bearer header into the session cookie and passes the
 * RFC-7807 problem detail through.
 */
import { NextResponse, type NextRequest } from "next/server";
import { env, SESSION_COOKIE } from "@/lib/env";

const ACTIONS = new Set(["confirm", "reject"]);

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; cid: string; action: string }> },
) {
  const { id, cid, action } = await ctx.params;
  const eventId = Number(id);
  const completionId = Number(cid);
  if (
    !Number.isInteger(eventId) ||
    eventId <= 0 ||
    !Number.isInteger(completionId) ||
    completionId <= 0 ||
    !ACTIONS.has(action)
  ) {
    return NextResponse.json({ detail: "bad request" }, { status: 400 });
  }
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) {
    return NextResponse.json({ detail: "Sign in to review completions." }, { status: 401 });
  }

  try {
    const res = await fetch(
      `${env.webApiInternalUrl}/api/v1/events/${eventId}/completions/${completionId}/${action}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          cookie: `${SESSION_COOKIE}=${bearer}`,
        },
        body: JSON.stringify({}),
      },
    );
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(body, { status: res.status });
  } catch (err) {
    console.error("[activity/completion-action]", err);
    return NextResponse.json({ detail: "Couldn't reach the event service." }, { status: 502 });
  }
}
