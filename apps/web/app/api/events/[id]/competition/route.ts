/**
 * BFF: the SOTW/BOTW competition board (web105a). The event page server-renders
 * the first payload; the standings table live-refetches here on SSE frames.
 * Delegates to the shared server client (forwards `dt_session`, Zod-validates).
 */
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  try {
    const board = await api.eventCompetition(eventId);
    return NextResponse.json(board, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
