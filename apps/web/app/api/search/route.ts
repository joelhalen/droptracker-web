/**
 * BFF: player/clan search, backing the homepage hero typeahead
 * (components/hero-search.tsx). Relays `api.search()` (Web API `/search`),
 * which Zod-validates the payload and falls back to mock data in dev.
 * The full-page flow at `/search` renders server-side and does not use this.
 */
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!q) return NextResponse.json({ players: [], groups: [] });

  try {
    return NextResponse.json(await api.search(q));
  } catch {
    // Typeahead is best-effort — an upstream hiccup should degrade to "no
    // suggestions", not surface an error in the hero.
    return NextResponse.json({ players: [], groups: [] });
  }
}
