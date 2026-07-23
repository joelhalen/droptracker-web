/**
 * BFF: Wise Old Man group preview for the group-setup wizard (bearer twin of
 * the site's lookupWom server action).
 */
import { NextResponse, type NextRequest } from "next/server";
import { bearerFrom, upstreamGet, UpstreamError } from "../../_lib";

export async function GET(req: NextRequest) {
  const bearer = bearerFrom(req);
  if (!bearer) {
    return NextResponse.json({ detail: "Sign in first." }, { status: 401 });
  }
  const womId = Number(req.nextUrl.searchParams.get("womId"));
  if (!Number.isInteger(womId) || womId <= 0) {
    return NextResponse.json({ detail: "womId required" }, { status: 400 });
  }
  try {
    const preview = await upstreamGet(`/groups/wom-lookup/${womId}`, { bearer });
    return NextResponse.json(preview, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    if (err instanceof UpstreamError) {
      const detail =
        err.status === 404
          ? "No Wise Old Man group found with that id."
          : "Couldn't look up that WOM group.";
      return NextResponse.json({ detail }, { status: err.status });
    }
    console.error("[activity/group-setup/wom-lookup]", err);
    return NextResponse.json({ detail: "Couldn't reach the service." }, { status: 502 });
  }
}
