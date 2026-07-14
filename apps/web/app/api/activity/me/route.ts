/**
 * BFF: session probe for the Discord Activity — bearer-token twin of
 * /api/me (which reads the dt_session cookie the iframe can't hold).
 * Powers the join panel: linked players + group memberships.
 */
import { NextResponse, type NextRequest } from "next/server";
import { MeSchema } from "@droptracker/api-types";
import { env, SESSION_COOKIE } from "@/lib/env";

export async function GET(req: NextRequest) {
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${env.webApiInternalUrl}/api/v1/me`, {
      headers: {
        accept: "application/json",
        cookie: `${SESSION_COOKIE}=${bearer}`,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: res.status === 401 ? 401 : 502 });
    }
    const me = MeSchema.parse(await res.json());
    return NextResponse.json(me, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    console.error("[activity/me]", err);
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
