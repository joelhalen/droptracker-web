/**
 * BFF: "what counts for this task" for the Discord Activity.
 *
 * Sibling of the `breakdown` route, but team-independent — it names the
 * qualifying items/pets/NPCs rather than reporting a team's progress against
 * them. Same bearer forwarding (a draft event still needs the viewer's
 * identity to be visible at all); cached longer because the answer only
 * changes when the task itself is edited.
 */
import { NextResponse, type NextRequest } from "next/server";
import { TaskRequirementsSchema } from "@droptracker/api-types";
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

  const bearer = bearerFrom(req);

  try {
    const data = await upstreamGet(`/events/${eventId}/tasks/${tId}/requirements`, {
      bearer: bearer || undefined,
      revalidate: 60,
    });
    return NextResponse.json(rewriteImgUrls(TaskRequirementsSchema.parse(data)));
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: `upstream ${err.status}` }, { status: err.status });
    }
    console.error("[activity/events/:id/tasks/:taskId/requirements]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
