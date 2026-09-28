/**
 * BFF: player/clan search, backing the site typeahead
 * (components/entity-search.tsx). Relays `api.search()` (Web API `/search`),
 * which Zod-validates the payload and falls back to mock data in dev.
 * `docs=1` adds matching docs pages (`api.searchDocs()`) as `docs`; scoped
 * fields (a leaderboard's player search) leave it off.
 * The full-page flow at `/search` renders server-side and does not use this.
 */
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!q) return NextResponse.json({ players: [], groups: [] });
  const withDocs = req.nextUrl.searchParams.get("docs") === "1";

  try {
    const [results, docs] = await Promise.all([
      api.search(q),
      withDocs ? api.searchDocs(q, 3).catch(() => []) : Promise.resolve(undefined),
    ]);
    return NextResponse.json(docs ? { ...results, docs } : results);
  } catch {
    // Typeahead is best-effort — an upstream hiccup should degrade to "no
    // suggestions", not surface an error in the hero.
    return NextResponse.json({ players: [], groups: [] });
  }
}
