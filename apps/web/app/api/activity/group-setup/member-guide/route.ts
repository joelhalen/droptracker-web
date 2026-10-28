/**
 * BFF: post the members' getting-started guide to a Discord channel (bearer
 * twin of the site's postWizardMemberGuide). Upstream checks the caller
 * administers the group and that the channel is in the group's server.
 */
import { NextResponse, type NextRequest } from "next/server";
import { bearerFrom, upstreamForward } from "../../_lib";

export async function POST(req: NextRequest) {
  const bearer = bearerFrom(req);
  if (!bearer) return NextResponse.json({ detail: "Sign in first." }, { status: 401 });
  const groupId = Number(req.nextUrl.searchParams.get("groupId"));
  if (!Number.isInteger(groupId) || groupId <= 0) {
    return NextResponse.json({ detail: "groupId required" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as { channel_id?: unknown };
  if (typeof body.channel_id !== "string" || !/^\d{15,21}$/.test(body.channel_id)) {
    return NextResponse.json({ detail: "Pick a channel." }, { status: 400 });
  }
  try {
    const res = await upstreamForward("POST", `/groups/${groupId}/member-guide`, bearer, { channel_id: body.channel_id });
    const out = await res.json().catch(() => ({}));
    return NextResponse.json(out, { status: res.status });
  } catch (err) {
    console.error("[activity/group-setup/member-guide]", err);
    return NextResponse.json({ detail: "Couldn't reach the service." }, { status: 502 });
  }
}
