/**
 * BFF: per-boss personal-best boards for the Discord Activity (anonymous).
 */
import { NextResponse, type NextRequest } from "next/server";
import { PbBossBoardSchema } from "@droptracker/api-types";
import { rewriteImgUrls, upstreamGet } from "../../_lib";

export async function GET(req: NextRequest) {
  const npcId = (req.nextUrl.searchParams.get("npcId") ?? "").trim();
  const groupId = (req.nextUrl.searchParams.get("groupId") ?? "").trim();
  if (!/^\d+$/.test(npcId)) {
    return NextResponse.json({ error: "npcId required" }, { status: 400 });
  }
  const q = new URLSearchParams({ npc_id: npcId, limit: "10" });
  if (/^\d+$/.test(groupId)) q.set("group_id", groupId);
  try {
    const board = PbBossBoardSchema.parse(
      await upstreamGet(`/personal-bests/board?${q}`, { revalidate: 60 }),
    );
    return NextResponse.json(rewriteImgUrls(board));
  } catch (err) {
    console.error("[activity/pbs/board]", err);
    return NextResponse.json({ error: "upstream error" }, { status: 502 });
  }
}
