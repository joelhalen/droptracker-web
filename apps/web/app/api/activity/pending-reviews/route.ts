/**
 * BFF: the session user's cross-event review queue — active events they
 * administer that have completions awaiting confirmation. Powers the
 * Activity's "awaiting review" pop-up and the event screen's admin badge.
 * Anonymous viewers simply get an empty list (no session, nothing to review).
 */
import { NextResponse, type NextRequest } from "next/server";
import { PendingReviewEventSchema } from "@droptracker/api-types";
import { bearerFrom, rewriteImgUrls, upstreamGet } from "../_lib";

export async function GET(req: NextRequest) {
  const bearer = bearerFrom(req);
  if (!bearer) return NextResponse.json([]);
  try {
    const data = PendingReviewEventSchema.array().parse(
      await upstreamGet("/events/pending-review", { bearer }),
    );
    return NextResponse.json(rewriteImgUrls(data));
  } catch (err) {
    console.error("[activity/pending-reviews]", err);
    // Best-effort surface — a failure just means no pop-up this launch.
    return NextResponse.json([]);
  }
}
