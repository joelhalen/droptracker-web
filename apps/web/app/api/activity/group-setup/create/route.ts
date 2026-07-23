/**
 * BFF: create the group (bearer twin of the site's createGroup server action).
 * All validation/conflict rules live upstream in POST /api/v1/groups; the
 * RFC-7807 problem body passes straight through so the wizard shows the real
 * reason (name too long, WOM already registered, ...).
 */
import { NextResponse, type NextRequest } from "next/server";
import { CreateGroupInputSchema } from "@droptracker/api-types";
import { bearerFrom, upstreamForward } from "../../_lib";

export async function POST(req: NextRequest) {
  const bearer = bearerFrom(req);
  if (!bearer) {
    return NextResponse.json({ detail: "Sign in to create a group." }, { status: 401 });
  }
  let input: unknown;
  try {
    input = CreateGroupInputSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ detail: "Invalid group details." }, { status: 400 });
  }
  try {
    const res = await upstreamForward("POST", `/groups`, bearer, input);
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(body, { status: res.status });
  } catch (err) {
    console.error("[activity/group-setup/create]", err);
    return NextResponse.json({ detail: "Couldn't reach the service." }, { status: 502 });
  }
}
