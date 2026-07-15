/**
 * BFF: per-(task, team) progress breakdown for the Discord Activity.
 *
 * Forwards the in-memory session bearer as the `dt_session` cookie (so the
 * breakdown can default to the viewer's own team and read drafts they can
 * see), passes through the `team_id` selector, and Zod-parses the shared
 * contract. Breakdown icons are `{type,id,name}` refs (no absolute URLs), but
 * we run the CSP img shim anyway for consistency.
 */
import { NextResponse, type NextRequest } from "next/server";
import { TaskBreakdownSchema } from "@droptracker/api-types";
import { bearerFrom, rewriteImgUrls, upstreamGet, UpstreamError } from "@/app/api/activity/_lib";

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

  const teamId = req.nextUrl.searchParams.get("team_id") ?? req.nextUrl.searchParams.get("teamId");
  const q = teamId ? `?team_id=${encodeURIComponent(teamId)}` : "";
  const bearer = bearerFrom(req);

  try {
    const data = await upstreamGet(`/events/${eventId}/tasks/${tId}/breakdown${q}`, {
      bearer: bearer || undefined,
      revalidate: 15,
    });
    return NextResponse.json(rewriteImgUrls(TaskBreakdownSchema.parse(data)));
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: `upstream ${err.status}` }, { status: err.status });
    }
    console.error("[activity/events/:id/tasks/:taskId/breakdown]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
