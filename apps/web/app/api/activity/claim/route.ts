/**
 * BFF: RSN claim for the Discord Activity — bearer twins of the site's claim
 * server actions. GET = read-only claim-preview (as-you-type feedback),
 * POST = the claim itself. The Activity passes the launch guild id so a
 * successful claim joins the player to that guild's group, exactly like
 * running /claim-rsn in that server. All rules are enforced upstream.
 */
import { NextResponse, type NextRequest } from "next/server";
import { bearerFrom, upstreamForward, upstreamGet, UpstreamError } from "../_lib";

export async function GET(req: NextRequest) {
  const bearer = bearerFrom(req);
  if (!bearer) {
    return NextResponse.json({ detail: "Sign in to claim an account." }, { status: 401 });
  }
  const rsn = (req.nextUrl.searchParams.get("rsn") ?? "").trim();
  if (!rsn) {
    return NextResponse.json({ detail: "rsn required" }, { status: 400 });
  }
  const guildId = (req.nextUrl.searchParams.get("guildId") ?? "").trim();
  const q = new URLSearchParams({ rsn });
  if (/^\d+$/.test(guildId)) q.set("guild_id", guildId);

  try {
    const preview = await upstreamGet(`/me/players/claim-preview?${q.toString()}`, { bearer });
    return NextResponse.json(preview, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ detail: "Couldn't check that name." }, { status: err.status });
    }
    console.error("[activity/claim GET]", err);
    return NextResponse.json({ detail: "Couldn't reach the claim service." }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const bearer = bearerFrom(req);
  if (!bearer) {
    return NextResponse.json({ detail: "Sign in to claim an account." }, { status: 401 });
  }
  let body: { rsn?: unknown; guild_id?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ detail: "Invalid claim request." }, { status: 400 });
  }
  const rsn = typeof body.rsn === "string" ? body.rsn.trim() : "";
  if (!rsn) {
    return NextResponse.json({ detail: "rsn required" }, { status: 400 });
  }
  const guildId = typeof body.guild_id === "string" ? body.guild_id.trim() : "";

  try {
    const res = await upstreamForward("POST", `/me/players/claim`, bearer, {
      rsn,
      ...(/^\d+$/.test(guildId) ? { guild_id: guildId } : {}),
    });
    const payload = await res.json().catch(() => ({}));
    return NextResponse.json(payload, { status: res.status });
  } catch (err) {
    console.error("[activity/claim POST]", err);
    return NextResponse.json({ detail: "Couldn't reach the claim service." }, { status: 502 });
  }
}
