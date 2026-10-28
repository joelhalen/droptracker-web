/**
 * BFF: the group's feature catalog ("Turn things on" wizard step) and
 * switching one on. Bearer twin of the site's fetchWizardFeatures /
 * enableWizardFeature server actions; group-admin gating is upstream
 * (GET/POST /api/v1/groups/{id}/features).
 */
import { NextResponse, type NextRequest } from "next/server";
import { bearerFrom, upstreamForward, upstreamGet, UpstreamError } from "../../_lib";

function groupIdFrom(req: NextRequest): number | null {
  const groupId = Number(req.nextUrl.searchParams.get("groupId"));
  return Number.isInteger(groupId) && groupId > 0 ? groupId : null;
}

export async function GET(req: NextRequest) {
  const bearer = bearerFrom(req);
  if (!bearer) return NextResponse.json({ detail: "Sign in first." }, { status: 401 });
  const groupId = groupIdFrom(req);
  if (!groupId) return NextResponse.json({ detail: "groupId required" }, { status: 400 });
  try {
    const body = await upstreamGet(`/groups/${groupId}/features`, { bearer });
    return NextResponse.json(body, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ detail: "Couldn't load features." }, { status: err.status });
    }
    console.error("[activity/group-setup/features]", err);
    return NextResponse.json({ detail: "Couldn't reach the service." }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const bearer = bearerFrom(req);
  if (!bearer) return NextResponse.json({ detail: "Sign in first." }, { status: 401 });
  const groupId = groupIdFrom(req);
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!groupId || !/^[a-z_]{1,40}$/.test(key)) {
    return NextResponse.json({ detail: "groupId and key required" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as { channel_id?: unknown };
  const channelId = typeof body.channel_id === "string" ? body.channel_id : null;
  try {
    const res = await upstreamForward("POST", `/groups/${groupId}/features/${key}`, bearer, { channel_id: channelId });
    const out = await res.json().catch(() => ({}));
    return NextResponse.json(out, { status: res.status });
  } catch (err) {
    console.error("[activity/group-setup/features]", err);
    return NextResponse.json({ detail: "Couldn't reach the service." }, { status: 502 });
  }
}
