/**
 * BFF: guild registration/bot-presence status for the group-setup wizard
 * (bearer twin of the site's checkGuild server action). `refresh=1` busts the
 * backend's bot-presence cache — the invite-the-bot poll uses it.
 */
import { NextResponse, type NextRequest } from "next/server";
import { bearerFrom, upstreamGet, UpstreamError } from "../../_lib";

export async function GET(req: NextRequest) {
  const bearer = bearerFrom(req);
  if (!bearer) {
    return NextResponse.json({ detail: "Sign in first." }, { status: 401 });
  }
  const guildId = (req.nextUrl.searchParams.get("guildId") ?? "").trim();
  if (!/^\d+$/.test(guildId)) {
    return NextResponse.json({ detail: "guildId required" }, { status: 400 });
  }
  const refresh = req.nextUrl.searchParams.get("refresh") === "1" ? "?refresh=1" : "";
  try {
    const status = await upstreamGet(`/groups/guild-status/${guildId}${refresh}`, { bearer });
    return NextResponse.json(status, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ detail: "Couldn't check that server." }, { status: err.status });
    }
    console.error("[activity/group-setup/guild-status]", err);
    return NextResponse.json({ detail: "Couldn't reach the service." }, { status: 502 });
  }
}
