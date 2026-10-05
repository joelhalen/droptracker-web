/**
 * BFF: announcements for the Discord Activity (anonymous): DropTracker's
 * global news, or one clan's (`scope=group:{id}`, what a group site shows).
 * Cover images are uploads on B2 or www, so they go through the image proxy;
 * images inside a body are mapped client-side by the embed host.
 */
import { NextResponse, type NextRequest } from "next/server";
import { AnnouncementPageSchema } from "@droptracker/api-types";
import { proxiedBoardImg, rewriteImgUrls, upstreamGet } from "../_lib";

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("scope") ?? "global").trim();
  const scope = /^(global|group:\d{1,9})$/.test(raw) ? raw : "global";
  try {
    const page = rewriteImgUrls(
      AnnouncementPageSchema.parse(
        await upstreamGet(`/announcements?scope=${encodeURIComponent(scope)}`, { revalidate: 30 }),
      ),
    );
    return NextResponse.json({
      ...page,
      items: page.items.map((a) => ({
        ...a,
        cover_image_url: proxiedBoardImg(a.cover_image_url) ?? a.cover_image_url,
      })),
    });
  } catch (err) {
    console.error("[activity/announcements]", err);
    return NextResponse.json({ error: "upstream error" }, { status: 502 });
  }
}
