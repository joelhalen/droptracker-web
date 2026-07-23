/**
 * BFF: the Discord servers the caller can manage (bearer twin of the site's
 * fetchManageableGuilds server action). Backs the Activity's group-setup
 * entry check ("does this user manage the launch guild?") and server step.
 */
import { NextResponse, type NextRequest } from "next/server";
import { bearerFrom, upstreamGet, UpstreamError } from "../../_lib";

export async function GET(req: NextRequest) {
  const bearer = bearerFrom(req);
  if (!bearer) {
    return NextResponse.json({ detail: "Sign in first." }, { status: 401 });
  }
  try {
    const guilds = await upstreamGet(`/me/guilds`, { bearer });
    return NextResponse.json(guilds, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ detail: "Couldn't load your servers." }, { status: err.status });
    }
    console.error("[activity/group-setup/guilds]", err);
    return NextResponse.json({ detail: "Couldn't reach the service." }, { status: 502 });
  }
}
