/**
 * BFF: Wise Old Man's gains for one period of a player's Overview tab. Asked
 * for by the browser, and only when our own history cannot answer, so a
 * profile render never spends WOM's request budget.
 */
import { NextResponse } from "next/server";
import { OVERVIEW_PERIODS, type OverviewPeriod } from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isInteger(playerId) || playerId < 0) {
    return NextResponse.json({ error: "bad player id" }, { status: 400 });
  }
  const raw = new URL(request.url).searchParams.get("period") ?? "week";
  if (!(OVERVIEW_PERIODS as readonly string[]).includes(raw)) {
    return NextResponse.json({ error: "bad period" }, { status: 400 });
  }
  try {
    return NextResponse.json(await api.playerWomGains(playerId, raw as OverviewPeriod), {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 502;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
