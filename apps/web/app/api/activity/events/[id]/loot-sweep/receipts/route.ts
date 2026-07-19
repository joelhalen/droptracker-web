/**
 * BFF: Loot Sweep per-item receipt ledger for the Discord Activity (bearer
 * twin of `api.eventLootSweepReceipts`) — powers the board's hover cards.
 * `task_id` + `item` query pass through; screenshot proof URLs are rewritten
 * to same-origin `/img` so thumbnails render inside the discordsays CSP.
 */
import { NextResponse, type NextRequest } from "next/server";
import { LootSweepReceiptsSchema } from "@droptracker/api-types";
import { env, SESSION_COOKIE } from "@/lib/env";
import { rewriteImgUrls } from "../../../../_lib";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "bad event id" }, { status: 400 });
  }
  const url = new URL(req.url);
  const taskId = url.searchParams.get("task_id") ?? "";
  const item = url.searchParams.get("item") ?? "";
  const q = new URLSearchParams({ task_id: taskId, item });
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  try {
    const res = await fetch(
      `${env.webApiInternalUrl}/api/v1/events/${eventId}/loot-sweep/receipts?${q}`,
      {
        headers: {
          accept: "application/json",
          ...(bearer ? { cookie: `${SESSION_COOKIE}=${bearer}` } : {}),
        },
        ...(bearer ? { cache: "no-store" as const } : { next: { revalidate: 10 } }),
      },
    );
    if (res.status === 404) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!res.ok) return NextResponse.json({ error: "upstream error" }, { status: 502 });
    return NextResponse.json(rewriteImgUrls(LootSweepReceiptsSchema.parse(await res.json())));
  } catch (err) {
    console.error("[activity/loot-sweep/receipts]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
