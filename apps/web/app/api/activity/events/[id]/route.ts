/**
 * BFF: event detail for the Discord Activity.
 *
 * The activity holds its session JWT in memory (no cookies inside the
 * discordsays.com iframe) and sends it as `Authorization: Bearer`; we forward
 * it upstream as the `dt_session` cookie header the Web API expects — the
 * exact header lib/api.ts synthesizes for the site — so the response includes
 * the viewer block. Without a bearer this is the plain anonymous read.
 */
import { NextResponse, type NextRequest } from "next/server";
import { EventDetailSchema } from "@droptracker/api-types";
import { env, SESSION_COOKIE } from "@/lib/env";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "bad event id" }, { status: 400 });
  }

  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  try {
    const res = await fetch(`${env.webApiInternalUrl}/api/v1/events/${eventId}`, {
      headers: {
        accept: "application/json",
        ...(bearer ? { cookie: `${SESSION_COOKIE}=${bearer}` } : {}),
      },
      // Authed reads must not be cached across viewers.
      ...(bearer ? { cache: "no-store" as const } : { next: { revalidate: 15 } }),
    });
    if (res.status === 404) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: "upstream error" }, { status: 502 });
    }
    const detail = EventDetailSchema.parse(await res.json());
    return NextResponse.json(detail);
  } catch (err) {
    console.error("[activity/events/:id]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
