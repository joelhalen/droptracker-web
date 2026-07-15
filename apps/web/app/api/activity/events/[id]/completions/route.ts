/**
 * BFF: one event's completion ledger for the Activity's review screen —
 * bearer-token twin of the site's admin ledger read. Admin authorization is
 * enforced upstream (401/403 pass through); only the pending queue is exposed
 * here since the mini-app's review screen doesn't page the full ledger.
 */
import { NextResponse, type NextRequest } from "next/server";
import { EventCompletionSchema } from "@droptracker/api-types";
import { bearerFrom, rewriteImgUrls, upstreamGet, UpstreamError } from "../../../_lib";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ detail: "bad event id" }, { status: 400 });
  }
  const bearer = bearerFrom(req);
  if (!bearer) {
    return NextResponse.json({ detail: "Sign in to review completions." }, { status: 401 });
  }
  try {
    const data = EventCompletionSchema.array().parse(
      await upstreamGet(`/events/${eventId}/completions?status=pending`, { bearer }),
    );
    return NextResponse.json(rewriteImgUrls(data));
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ detail: "Couldn't load the review queue." }, { status: err.status });
    }
    console.error("[activity/completions]", err);
    return NextResponse.json({ detail: "Couldn't load the review queue." }, { status: 502 });
  }
}
