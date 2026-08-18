/**
 * BFF: "what actually counts" for one task — every qualifying item/pet/NPC,
 * named and icon-resolved. Loaded on demand when a member opens a task's
 * detail (the event page is server-rendered, so this needs a same-origin,
 * cookie-authed endpoint), and shared by the organiser-side preview.
 *
 * Unlike the sibling `breakdown` route this carries no team progress, so the
 * response is identical for every viewer of the event and is safe to cache
 * briefly at the edge of the browser.
 */
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await ctx.params;
  const eventId = Number(id);
  const tId = Number(taskId);
  if (!Number.isInteger(eventId) || eventId <= 0 || !Number.isInteger(tId) || tId <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  try {
    const requirements = await api.taskRequirements(eventId, tId);
    return NextResponse.json(requirements, {
      headers: { "cache-control": "private, max-age=60" },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
