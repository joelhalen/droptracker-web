/**
 * BFF: save wizard config keys (channel ids) for a group — bearer twin of the
 * site's saveWizardConfig server action. Key validation + group-admin gating
 * live upstream in PATCH /api/v1/groups/{id}/config.
 */
import { NextResponse, type NextRequest } from "next/server";
import { bearerFrom, upstreamForward } from "../../_lib";

export async function PATCH(req: NextRequest) {
  const bearer = bearerFrom(req);
  if (!bearer) {
    return NextResponse.json({ detail: "Sign in first." }, { status: 401 });
  }
  const groupId = Number(req.nextUrl.searchParams.get("groupId"));
  if (!Number.isInteger(groupId) || groupId <= 0) {
    return NextResponse.json({ detail: "groupId required" }, { status: 400 });
  }
  let patch: unknown;
  try {
    patch = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid config payload." }, { status: 400 });
  }
  if (typeof patch !== "object" || patch === null || Array.isArray(patch)) {
    return NextResponse.json({ detail: "Invalid config payload." }, { status: 400 });
  }
  try {
    const res = await upstreamForward("PATCH", `/groups/${groupId}/config`, bearer, patch);
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(body, { status: res.status });
  } catch (err) {
    console.error("[activity/group-setup/config]", err);
    return NextResponse.json({ detail: "Couldn't reach the service." }, { status: 502 });
  }
}
