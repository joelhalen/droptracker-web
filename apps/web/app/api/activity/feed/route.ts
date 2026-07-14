/**
 * BFF: recent live-feed history for the Discord Activity home screen
 * (anonymous; hidden players already filtered upstream).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { rewriteImgUrls, upstreamGet } from "../_lib";

const FeedEventSchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = FeedEventSchema.array().parse(await upstreamGet("/feed/recent"));
    return NextResponse.json(rewriteImgUrls(events), {
      headers: { "cache-control": "public, max-age=10" },
    });
  } catch (err) {
    console.error("[activity/feed]", err);
    return NextResponse.json({ error: "upstream error" }, { status: 502 });
  }
}
