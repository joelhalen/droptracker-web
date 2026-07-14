/**
 * BFF: claim the current user's pending Activity deep-link target.
 *
 * When someone taps an "Open in Discord" launch button on an event message,
 * the bot records the event id against their Discord id; the Activity claims
 * it here (one-shot) right after OAuth and opens straight to that event.
 * Best-effort: any failure degrades to `{ event_id: null }` (open the home hub).
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { bearerFrom, upstreamGet } from "../_lib";

const LaunchTargetSchema = z.object({ event_id: z.number().int().nullable() });

export async function GET(req: NextRequest) {
  const bearer = bearerFrom(req);
  if (!bearer) return NextResponse.json({ event_id: null });
  try {
    const data = LaunchTargetSchema.parse(
      await upstreamGet("/events/launch-intent", { bearer }),
    );
    return NextResponse.json(data);
  } catch (err) {
    console.error("[activity/launch-intent]", err);
    return NextResponse.json({ event_id: null });
  }
}
