/**
 * BFF: the live Conquest map for the Discord Activity: the bearer twin of the
 * site's `fetchEventConquest` server action, which reads the cookie session the
 * iframe doesn't have. The map's background art is uploaded to B2 (or sample
 * art on www), so it goes through the same-origin image proxy.
 */
import { NextResponse, type NextRequest } from "next/server";
import { ConquestMapSchema } from "@droptracker/api-types";
import {
  bearerFrom,
  proxiedBoardImg,
  rewriteImgUrls,
  upstreamGet,
  UpstreamError,
} from "@/app/api/activity/_lib";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "bad event id" }, { status: 400 });
  }
  const bearer = bearerFrom(req);
  try {
    const map = rewriteImgUrls(
      ConquestMapSchema.parse(
        await upstreamGet(`/events/${eventId}/conquest`, { bearer: bearer || undefined, revalidate: 5 }),
      ),
    );
    return NextResponse.json({
      ...map,
      background_url: proxiedBoardImg(map.background_url) ?? map.background_url,
    });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: `upstream ${err.status}` }, { status: err.status });
    }
    console.error("[activity/events/:id/conquest]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
