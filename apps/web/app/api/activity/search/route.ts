/**
 * BFF: combined typeahead search for the Discord Activity (anonymous; npc/item
 * icon URLs rewritten for the iframe CSP).
 */
import { NextResponse, type NextRequest } from "next/server";
import { SearchResultsSchema } from "@droptracker/api-types";
import { rewriteImgUrls, upstreamGet } from "../_lib";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ players: [], groups: [], npcs: [], items: [] });
  }
  try {
    const results = SearchResultsSchema.parse(
      await upstreamGet(`/search?q=${encodeURIComponent(q)}`, { revalidate: 10 }),
    );
    return NextResponse.json(rewriteImgUrls(results));
  } catch (err) {
    console.error("[activity/search]", err);
    return NextResponse.json({ error: "upstream error" }, { status: 502 });
  }
}
