/**
 * BFF: public player profile for the Discord Activity (anonymous; hidden
 * players 404 upstream and stay 404 here).
 */
import { NextResponse, type NextRequest } from "next/server";
import { PlayerProfileSchema } from "@droptracker/api-types";
import { rewriteImgUrls, upstreamGet, UpstreamError } from "../../_lib";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  try {
    const profile = PlayerProfileSchema.parse(
      await upstreamGet(`/players/${id}`, { revalidate: 30 }),
    );
    return NextResponse.json(rewriteImgUrls(profile));
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 404) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    console.error("[activity/players/:id]", err);
    return NextResponse.json({ error: "upstream error" }, { status: 502 });
  }
}
