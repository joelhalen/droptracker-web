/**
 * BFF: board-game board for the Discord Activity (bearer-token twin of the
 * site's `api.eventBoard`). Draft visibility is enforced upstream; anonymous
 * viewers see active/past boards. Icon URLs are rewritten to same-origin /img
 * and the (B2/www-hosted) background is routed through the board-img proxy so
 * everything renders inside the discordsays CSP.
 */
import { NextResponse, type NextRequest } from "next/server";
import { BoardDetailSchema } from "@droptracker/api-types";
import { env, SESSION_COOKIE } from "@/lib/env";
import { proxiedBoardImg, rewriteImgUrls } from "../../../_lib";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "bad event id" }, { status: 400 });
  }

  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  try {
    const res = await fetch(`${env.webApiInternalUrl}/api/v1/events/${eventId}/board`, {
      headers: {
        accept: "application/json",
        ...(bearer ? { cookie: `${SESSION_COOKIE}=${bearer}` } : {}),
      },
      ...(bearer ? { cache: "no-store" as const } : { next: { revalidate: 10 } }),
    });
    if (res.status === 404) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!res.ok) return NextResponse.json({ error: "upstream error" }, { status: 502 });

    // www/img icons → relative /img; then the cross-origin background (and any
    // custom piece art) through the same-origin image proxy.
    const board = rewriteImgUrls(BoardDetailSchema.parse(await res.json()));
    board.background_url = proxiedBoardImg(board.background_url) ?? null;
    for (const p of board.positions) {
      if (p.piece_icon_url) p.piece_icon_url = proxiedBoardImg(p.piece_icon_url) ?? null;
    }
    return NextResponse.json(board);
  } catch (err) {
    console.error("[activity/board]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
