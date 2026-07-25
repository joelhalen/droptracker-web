/**
 * BFF: player loot tracker period switching. The profile page server-renders
 * the current month; the LootTracker client component fetches other months —
 * and the all-time view (`?partition=all`) — through this route (browser never
 * talks to the Web API directly).
 */
import { NextResponse } from "next/server";
import { LOOT_ALL_TIME, type LootPeriod } from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isFinite(playerId)) {
    return NextResponse.json({ error: "bad player id" }, { status: 400 });
  }
  const raw = new URL(request.url).searchParams.get("partition");
  let partition: LootPeriod | undefined;
  if (raw === LOOT_ALL_TIME) {
    partition = LOOT_ALL_TIME;
  } else if (raw) {
    partition = Number(raw);
    if (!Number.isFinite(partition)) {
      return NextResponse.json({ error: "bad partition" }, { status: 400 });
    }
  }

  try {
    return NextResponse.json(await api.playerLoot(playerId, partition));
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 502;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
