/** Boss-name autocomplete for the page builder's boss leaderboard block. */
import { NextResponse, type NextRequest } from "next/server";
import { searchBuilderNpcs } from "@/lib/page-layout/builder-ops";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  const results = await searchBuilderNpcs(q);
  return NextResponse.json(results.map((r) => ({ id: r.id, name: r.name })));
}
