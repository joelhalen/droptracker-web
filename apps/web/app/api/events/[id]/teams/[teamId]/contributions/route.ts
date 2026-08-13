/**
 * BFF: one team's submission log (t62) — "who got what, when", with proof.
 * The team page is server-rendered but the log paginates client-side, so it
 * needs a same-origin, cookie-authed endpoint. Delegates to the shared server
 * client (forwards `dt_session` so event admins see hidden tasks and the real
 * RSN behind a masked row, and Zod-validates the response).
 */
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; teamId: string }> },
) {
  const { id, teamId } = await ctx.params;
  const eventId = Number(id);
  const team = Number(teamId);
  if (!Number.isInteger(eventId) || eventId <= 0 || !Number.isInteger(team) || team <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  const sp = req.nextUrl.searchParams;
  const num = (key: string) => {
    const v = sp.get(key);
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };

  try {
    const log = await api.eventTeamContributions(eventId, team, {
      page: num("page"),
      limit: num("limit"),
    });
    return NextResponse.json(log, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
