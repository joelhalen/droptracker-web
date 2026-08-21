/**
 * BFF: the gear and inventory a personal best was set with.
 *
 * The PB grid renders server-side, but a loadout is only fetched when someone
 * actually expands an entry — most never are, and fetching all of them up front
 * would be dozens of reads for data nobody looks at. The browser never talks to
 * the Web API directly, so it goes through here.
 */
import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ pbId: string }> }) {
  const { pbId } = await params;
  const id = Number(pbId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "bad personal best id" }, { status: 400 });
  }

  try {
    return NextResponse.json(await api.personalBestLoadout(id));
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
