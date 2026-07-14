/**
 * BFF: personal-best boss index for the Discord Activity (anonymous).
 */
import { NextResponse, type NextRequest } from "next/server";
import { PbBossIndexSchema } from "@droptracker/api-types";
import { rewriteImgUrls, upstreamGet } from "../_lib";

export async function GET(req: NextRequest) {
  const groupId = (req.nextUrl.searchParams.get("groupId") ?? "").trim();
  const q = /^\d+$/.test(groupId) ? `?group_id=${groupId}` : "";
  try {
    const index = PbBossIndexSchema.parse(
      await upstreamGet(`/personal-bests/bosses${q}`, { revalidate: 60 }),
    );
    return NextResponse.json(rewriteImgUrls(index));
  } catch (err) {
    console.error("[activity/pbs]", err);
    return NextResponse.json({ error: "upstream error" }, { status: 502 });
  }
}
