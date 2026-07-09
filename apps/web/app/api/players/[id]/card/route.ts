/**
 * BFF: compact player summary for hover cards. Reduces the full profile
 * (`api.player()`) to `PlayerCard` (lib/entity-card.ts) so cards stay tiny
 * and cacheable; fetched lazily by `components/entity-hover-card.tsx`.
 */
import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";
import { toPlayerCard } from "@/lib/entity-card";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isFinite(playerId)) {
    return NextResponse.json({ error: "bad player id" }, { status: 400 });
  }
  try {
    const card = toPlayerCard(await api.player(playerId));
    // Fresh enough for a hover popover; saves refetching while browsing a page.
    return NextResponse.json(card, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 502;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
