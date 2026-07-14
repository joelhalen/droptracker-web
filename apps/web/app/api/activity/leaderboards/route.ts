/**
 * BFF: leaderboards for the Discord Activity (anonymous upstream; icon URLs
 * rewritten to same-origin /img for the iframe CSP — see ../_lib.ts).
 */
import { NextResponse, type NextRequest } from "next/server";
import { LeaderboardPageSchema } from "@droptracker/api-types";
import { rewriteImgUrls, upstreamGet } from "../_lib";

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind") === "groups" ? "groups" : "players";
  const period = (req.nextUrl.searchParams.get("period") ?? "").trim();
  const scope = (req.nextUrl.searchParams.get("scope") ?? "").trim();

  const q = new URLSearchParams({ limit: "25" });
  if (period) q.set("period", period);
  if (kind === "players" && /^(global|group:\d+|npc:\d+)$/.test(scope)) q.set("scope", scope);

  try {
    const page = LeaderboardPageSchema.parse(
      await upstreamGet(`/leaderboards/${kind}?${q}`, { revalidate: 20 }),
    );
    return NextResponse.json(rewriteImgUrls(page));
  } catch (err) {
    console.error("[activity/leaderboards]", err);
    return NextResponse.json({ error: "upstream error" }, { status: 502 });
  }
}
