/**
 * BFF: a group's lootboard for the Discord Activity (anonymous), for one
 * period. The template background is uploaded art on B2 or www, so it goes
 * through the same-origin image proxy; icons are rewritten to `/img`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { LootboardSchema } from "@droptracker/api-types";
import { proxiedBoardImg, rewriteImgUrls, upstreamGet, UpstreamError } from "../../../_lib";

const PERIOD = /^(all|\d{6}|\d{8}|\d{4}W\d{2})$/;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const raw = (req.nextUrl.searchParams.get("period") ?? "month").trim();
  const period = PERIOD.test(raw) ? raw : "month";
  try {
    const board = rewriteImgUrls(
      LootboardSchema.parse(
        await upstreamGet(`/groups/${id}/lootboard?period=${encodeURIComponent(period)}`, {
          revalidate: 30,
        }),
      ),
    );
    return NextResponse.json({
      ...board,
      background_url: proxiedBoardImg(board.background_url) ?? undefined,
    });
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 404) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    console.error("[activity/groups/:id/lootboard]", err);
    return NextResponse.json({ error: "upstream error" }, { status: 502 });
  }
}
