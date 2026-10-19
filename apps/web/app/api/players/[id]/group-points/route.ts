/**
 * BFF: a player's clan points for their profile (`components/player-clan-points.tsx`).
 * Forwards the viewer's session: which clan is shown depends on who is looking,
 * and members-only boards are only quoted to members. Never cached.
 */
import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isInteger(playerId)) {
    return NextResponse.json({ error: "bad player id" }, { status: 400 });
  }
  try {
    const data = await api.playerGroupPoints(playerId);
    return NextResponse.json(data, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 502;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
