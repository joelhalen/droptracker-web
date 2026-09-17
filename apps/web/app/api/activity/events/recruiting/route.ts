/**
 * BFF: clan-vs-clan events the session user's clans are recruiting for — the
 * Activity twin of the site events page's "Your clans are recruiting" banner
 * (`api.eventRecruiting`). The list is about the viewer's own clans, so an
 * anonymous request simply gets an empty one.
 *
 * A static segment beside `events/[id]`: Next matches it first, and `[id]`
 * only ever takes numeric ids anyway.
 */
import { NextResponse, type NextRequest } from "next/server";
import { EventRecruitingItemSchema } from "@droptracker/api-types";
import { bearerFrom, upstreamGet } from "@/app/api/activity/_lib";

export async function GET(req: NextRequest) {
  const bearer = bearerFrom(req);
  if (!bearer) return NextResponse.json([]);
  try {
    const items = EventRecruitingItemSchema.array().parse(
      await upstreamGet("/events/recruiting", { bearer }),
    );
    return NextResponse.json(items, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    console.error("[activity/events/recruiting]", err);
    // A best-effort banner, as on the site (which falls back to an empty list).
    return NextResponse.json([]);
  }
}
