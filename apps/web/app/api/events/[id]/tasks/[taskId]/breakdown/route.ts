/**
 * BFF: per-(task, team) progress breakdown for the website's client-side task
 * detail card. The event page is server-rendered, but the breakdown loads
 * on-demand when a member opens a task (and re-loads when they switch teams),
 * so it needs a same-origin, cookie-authed endpoint. Delegates to the shared
 * server client (which forwards `dt_session` + Zod-validates the response).
 */
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await ctx.params;
  const eventId = Number(id);
  const tId = Number(taskId);
  if (!Number.isInteger(eventId) || eventId <= 0 || !Number.isInteger(tId) || tId <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  const teamParam = req.nextUrl.searchParams.get("team_id") ?? req.nextUrl.searchParams.get("teamId");
  const teamId = teamParam != null && teamParam !== "" ? Number(teamParam) : undefined;

  try {
    const breakdown = await api.taskBreakdown(
      eventId,
      tId,
      teamId != null && Number.isInteger(teamId) ? teamId : undefined,
    );
    return NextResponse.json(breakdown, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
