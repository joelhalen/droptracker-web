/**
 * BFF: same-origin image proxy for the Discord Activity's board view.
 *
 * Board backgrounds are uploaded to the B2 CDN (videos.droptracker.io) and the
 * sample art lives on www — both cross-origin to activity.droptracker.io and so
 * blocked by the discordsays iframe CSP (which only allows the mapped root host
 * and same-origin /img). This streams the image through the activity host so it
 * loads. Host-allowlisted (BOARD_IMG_HOSTS) so it can't be an open proxy.
 */
import { NextResponse, type NextRequest } from "next/server";
import { BOARD_IMG_HOSTS } from "../_lib";

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return NextResponse.json({ error: "missing u" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(u);
  } catch {
    return NextResponse.json({ error: "bad url" }, { status: 400 });
  }
  if (target.protocol !== "https:" || !BOARD_IMG_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: "host not allowed" }, { status: 400 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: { accept: "image/*" },
      next: { revalidate: 300 },
    });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "upstream error" }, { status: 502 });
    }
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "image/png",
        "cache-control": "public, max-age=300",
      },
    });
  } catch (err) {
    console.error("[activity/board-img]", err);
    return NextResponse.json({ error: "unreachable" }, { status: 502 });
  }
}
