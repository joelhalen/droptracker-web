/**
 * BFF: one player's contribution drill-down for the Players tab. The tab is
 * server-rendered, but a row's item/task detail loads on-demand when expanded,
 * so it needs a same-origin, cookie-authed endpoint. Delegates to the shared
 * server client (forwards `dt_session` + Zod-validates the response).
 */
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; playerId: string }> },
) {
  const { id, playerId } = await ctx.params;
  const eventId = Number(id);
  const pId = Number(playerId);
  if (!Number.isInteger(eventId) || eventId <= 0 || !Number.isInteger(pId) || pId <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  try {
    const detail = await api.eventPlayerDetail(eventId, pId);
    return NextResponse.json(detail, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
