/**
 * BFF: guild-scoped event list for the Discord Activity.
 *
 * Anonymous — the list endpoint is public upstream; the activity only knows
 * the Discord guild it launched in, which the Web API resolves to the linked
 * group's events (plus events explicitly pointed at the guild).
 */
import { NextResponse, type NextRequest } from "next/server";
import { EventSummarySchema } from "@droptracker/api-types";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  const guildId = (req.nextUrl.searchParams.get("guildId") ?? "").trim();
  const status = req.nextUrl.searchParams.get("status");
  if (!/^\d+$/.test(guildId)) {
    return NextResponse.json({ error: "guildId required" }, { status: 400 });
  }

  const q = new URLSearchParams({ guildId });
  if (status === "active" || status === "past") q.set("status", status);

  try {
    const res = await fetch(`${env.webApiInternalUrl}/api/v1/events?${q.toString()}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "upstream error" }, { status: 502 });
    }
    const events = EventSummarySchema.array().parse(await res.json());
    return NextResponse.json(events);
  } catch (err) {
    console.error("[activity/events]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
