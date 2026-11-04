/**
 * BFF: one player board narrowed to a game mode, for the client-side
 * account-type filter on group pages. The unfiltered board is server-rendered
 * with the page; this only runs when a visitor picks a mode.
 */
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/lib/api";
import { accountTypeFilter } from "@/lib/account-types";

export const dynamic = "force-dynamic";

const SCOPE = /^(global|group:\d+|npc:\d+|group:\d+:npc:\d+)$/;
const PERIOD = /^(all|month|week|day|\d{6}|\d{8}|\d{4}W\d{2})$/;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const scope = (sp.get("scope") ?? "").trim();
  const period = (sp.get("period") ?? "month").trim();
  const filter = accountTypeFilter(sp.get("account_type"));
  const limit = Math.min(50, Math.max(1, Number(sp.get("limit")) || 10));
  if (!SCOPE.test(scope) || !PERIOD.test(period) || !filter) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  try {
    const page = await api.playerLeaderboard({ scope, period, limit, accountType: filter.key });
    return NextResponse.json(page, { headers: { "Cache-Control": "public, max-age=15" } });
  } catch (err) {
    console.error("[leaderboards/players]", err);
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
