/**
 * BFF: event list for the Discord Activity, two scopes:
 *
 * - `guildId=<snowflake>` — the guild the activity launched in (anonymous;
 *   the Web API resolves it to the linked group's events plus events
 *   explicitly pointed at the guild).
 * - `mine=1` — the session user's events across every group they belong to
 *   (bearer token required). Used when the activity launches without a guild
 *   context — an Activity Link opened from a DM.
 */
import { NextResponse, type NextRequest } from "next/server";
import { EventSummarySchema } from "@droptracker/api-types";
import { env, SESSION_COOKIE } from "@/lib/env";

export async function GET(req: NextRequest) {
  const guildId = (req.nextUrl.searchParams.get("guildId") ?? "").trim();
  const mine = req.nextUrl.searchParams.get("mine") === "1";
  const status = req.nextUrl.searchParams.get("status");
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  if (!mine && !/^\d+$/.test(guildId)) {
    return NextResponse.json({ error: "guildId or mine=1 required" }, { status: 400 });
  }
  if (mine && !bearer) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const q = new URLSearchParams(mine ? { mine: "1" } : { guildId });
  if (status === "draft" || status === "active" || status === "past") q.set("status", status);

  // Guild-scoped requests also forward the session when one is presented:
  // the backend then includes draft events visible to the viewer (member of
  // a participating clan — the pre-publication landing page). Any request
  // carrying a session is viewer-specific and must never be cached across
  // users.
  const authed = mine || Boolean(bearer);
  try {
    const res = await fetch(`${env.webApiInternalUrl}/api/v1/events?${q.toString()}`, {
      headers: {
        accept: "application/json",
        ...(authed ? { cookie: `${SESSION_COOKIE}=${bearer}` } : {}),
      },
      ...(authed ? { cache: "no-store" as const } : { next: { revalidate: 30 } }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "upstream error" }, { status: 502 });
    }
    const events = EventSummarySchema.array().parse(await res.json());
    return NextResponse.json(
      events,
      authed ? { headers: { "cache-control": "private, no-store" } } : undefined,
    );
  } catch (err) {
    console.error("[activity/events]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
