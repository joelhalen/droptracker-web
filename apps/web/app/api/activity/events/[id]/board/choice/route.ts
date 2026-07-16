/**
 * BFF: resolve a pending board task choice for the Discord Activity (bearer
 * twin of `api.resolveEventBoardChoice`; choose_task items like Cache of Runes).
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
  if (!bearer) return NextResponse.json({ detail: "Sign in to choose a task." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { choice_index?: unknown };
  const choiceIndex = Number(body.choice_index);
  if (!Number.isInteger(choiceIndex) || choiceIndex < 0) {
    return NextResponse.json({ detail: "Invalid choice." }, { status: 400 });
  }

  try {
    const res = await upstreamForward("POST", `/events/${eventId}/board/choice`, bearer, {
      choice_index: choiceIndex,
    });
    const out = await res.json().catch(() => ({}));
    return NextResponse.json(out, { status: res.status });
  } catch (err) {
    console.error("[activity/board/choice]", err);
    return NextResponse.json({ detail: "Couldn't reach the event service." }, { status: 502 });
  }
}
