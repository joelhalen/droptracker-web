/**
 * BFF: resolve the launch channel to its event — the anonymous deep-link
 * fallback for the Activity. A launch button opens the app in its own channel;
 * `sdk.channelId` tells us which, and the Web API maps that to the event whose
 * board/notifications live there. Best-effort: `{ event_id: null }` on any miss.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { upstreamGet } from "../_lib";

const LaunchTargetSchema = z.object({ event_id: z.number().int().nullable() });

export async function GET(req: NextRequest) {
  const channelId = (req.nextUrl.searchParams.get("channelId") ?? "").trim();
  if (!/^\d+$/.test(channelId)) return NextResponse.json({ event_id: null });
  try {
    const data = LaunchTargetSchema.parse(
      await upstreamGet(`/events/by-channel/${channelId}`, { revalidate: 30 }),
    );
    return NextResponse.json(data);
  } catch (err) {
    console.error("[activity/event-by-channel]", err);
    return NextResponse.json({ event_id: null });
  }
}
