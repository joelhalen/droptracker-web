/**
 * BFF: a player's achievement diary journal. Fetched by the profile only when
 * the Diaries tab is opened: the payload is every task of every diary, and the
 * backend may consult the wiki's WikiSync data to fill in which are done, so
 * it stays off the page's own render.
 */
import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isInteger(playerId) || playerId < 0) {
    return NextResponse.json({ error: "bad player id" }, { status: 400 });
  }
  try {
    return NextResponse.json(await api.playerDiaries(playerId), {
      headers: { "Cache-Control": "public, max-age=120" },
    });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 502;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
