/**
 * BFF: a group's Clan Log for the Discord Activity (anonymous): the board for
 * one period plus the periods it can be shown for, in one read. A group whose
 * board has never been built answers `board: null`, not an error.
 */
import { NextResponse, type NextRequest } from "next/server";
import { ClanLogPeriodsSchema, ClanLogSchema } from "@droptracker/api-types";
import { rewriteImgUrls, upstreamGet, UpstreamError } from "../../../_lib";

const PERIOD = /^(all|\d{4}(-\d{2})?)$/;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const raw = (req.nextUrl.searchParams.get("period") ?? "all").trim();
  const period = PERIOD.test(raw) ? raw : "all";
  const board = await upstreamGet(`/groups/${id}/clan-log?period=${encodeURIComponent(period)}`, {
    revalidate: 300,
  })
    .then((b) => ClanLogSchema.parse(b))
    .catch((err) => {
      if (!(err instanceof UpstreamError && err.status === 404)) {
        console.error("[activity/groups/:id/clan-log]", err);
      }
      return null;
    });
  const periods = await upstreamGet(`/groups/${id}/clan-log/periods`, { revalidate: 300 })
    .then((p) => ClanLogPeriodsSchema.parse(p).periods)
    .catch(() => [] as string[]);
  return NextResponse.json(rewriteImgUrls({ board, periods }));
}
