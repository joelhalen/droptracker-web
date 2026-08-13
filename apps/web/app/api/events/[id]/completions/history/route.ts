/**
 * BFF: public completion history for the event page's on-demand "Completions"
 * tab. The page is server-rendered, but the history paginates + filters client
 * side, so it needs a same-origin, cookie-authed endpoint. Delegates to the
 * shared server client (forwards `dt_session` so admins see hidden rows, and
 * Zod-validates the response).
 */
import { NextResponse, type NextRequest } from "next/server";
import { COMPLETION_HISTORY_MODES, api, type CompletionHistoryMode } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  const sp = req.nextUrl.searchParams;
  const num = (key: string) => {
    const v = sp.get(key);
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };

  // Unknown values fall through as undefined so the backend keeps its own
  // default rather than 422-ing a hand-typed URL.
  const rawMode = sp.get("mode");
  const mode = COMPLETION_HISTORY_MODES.includes(rawMode as CompletionHistoryMode)
    ? (rawMode as CompletionHistoryMode)
    : undefined;

  try {
    const history = await api.eventCompletionHistory(eventId, {
      page: num("page"),
      teamId: num("teamId"),
      taskId: num("taskId"),
      player: sp.get("player") ?? undefined,
      mode,
      taskType: sp.get("taskType") ?? undefined,
    });
    return NextResponse.json(history, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
