/**
 * BFF: the bot's cached Discord channel list for a group (bearer twin of the
 * site's fetchWizardChannels server action). Group-admin gating is upstream.
 */
import { NextResponse, type NextRequest } from "next/server";
import { bearerFrom, upstreamGet, UpstreamError } from "../../_lib";

export async function GET(req: NextRequest) {
  const bearer = bearerFrom(req);
  if (!bearer) {
    return NextResponse.json({ detail: "Sign in first." }, { status: 401 });
  }
  const groupId = Number(req.nextUrl.searchParams.get("groupId"));
  if (!Number.isInteger(groupId) || groupId <= 0) {
    return NextResponse.json({ detail: "groupId required" }, { status: 400 });
  }
  try {
    const channels = await upstreamGet(`/groups/${groupId}/discord-channels`, { bearer });
    return NextResponse.json(channels, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ detail: "Couldn't load channels." }, { status: err.status });
    }
    console.error("[activity/group-setup/channels]", err);
    return NextResponse.json({ detail: "Couldn't reach the service." }, { status: 502 });
  }
}
