/**
 * BFF: an item's page for the Discord Activity (anonymous).
 */
import { NextResponse, type NextRequest } from "next/server";
import { ItemDetailSchema } from "@droptracker/api-types";
import { rewriteImgUrls, upstreamGet, UpstreamError } from "../../_lib";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  try {
    const item = ItemDetailSchema.parse(await upstreamGet(`/items/${id}`, { revalidate: 60 }));
    return NextResponse.json(rewriteImgUrls(item));
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 404) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    console.error("[activity/items/:id]", err);
    return NextResponse.json({ error: "upstream error" }, { status: 502 });
  }
}
