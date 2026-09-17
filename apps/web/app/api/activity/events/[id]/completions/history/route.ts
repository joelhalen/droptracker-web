/**
 * BFF: an event's public completion history for the Discord Activity — the
 * bearer-token twin of the site's `/api/events/[id]/completions/history`
 * (paginated, filterable; hidden players are masked upstream for non-admins).
 * A static segment beside `completions/[cid]`, which Next matches first.
 */
import { NextResponse, type NextRequest } from "next/server";
import { COMPLETION_HISTORY_MODES, CompletionHistorySchema } from "@/lib/api/types";
import { bearerFrom, rewriteImgUrls, upstreamGet, UpstreamError } from "../../../../_lib";

/** Only the filters the backend understands, with the same validation as the
 * site route — anything else is dropped rather than forwarded. */
function forwardedQuery(sp: URLSearchParams): URLSearchParams {
  const q = new URLSearchParams();
  for (const key of ["page", "teamId", "taskId"]) {
    const v = Number(sp.get(key));
    if (Number.isInteger(v) && v > 0) q.set(key, String(v));
  }
  const player = sp.get("player")?.trim();
  if (player) q.set("player", player.slice(0, 64));
  const mode = sp.get("mode");
  if (mode && (COMPLETION_HISTORY_MODES as readonly string[]).includes(mode)) q.set("mode", mode);
  const taskType = sp.get("taskType")?.trim();
  if (taskType && /^[a-z_]{1,40}$/.test(taskType)) q.set("taskType", taskType);
  return q;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ detail: "bad event id" }, { status: 400 });
  }
  const bearer = bearerFrom(req);
  const q = forwardedQuery(req.nextUrl.searchParams);
  try {
    const history = CompletionHistorySchema.parse(
      await upstreamGet(`/events/${eventId}/completions/history?${q}`, { bearer }),
    );
    return NextResponse.json(rewriteImgUrls(history), {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ detail: "Couldn't load the history." }, { status: err.status });
    }
    console.error("[activity/events/:id/completions/history]", err);
    return NextResponse.json({ detail: "Couldn't load the history." }, { status: 502 });
  }
}
