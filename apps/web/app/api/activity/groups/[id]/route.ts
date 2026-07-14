/**
 * BFF: public group profile for the Discord Activity (anonymous).
 */
import { NextResponse, type NextRequest } from "next/server";
import { GroupProfileSchema } from "@droptracker/api-types";
import { rewriteImgUrls, upstreamGet, UpstreamError } from "../../_lib";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  try {
    const profile = GroupProfileSchema.parse(await upstreamGet(`/groups/${id}`, { revalidate: 30 }));
    return NextResponse.json(rewriteImgUrls(profile));
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 404) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    console.error("[activity/groups/:id]", err);
    return NextResponse.json({ error: "upstream error" }, { status: 502 });
  }
}
