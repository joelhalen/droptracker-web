/**
 * BFF: docs full-text search, backing the docs sidebar's search field
 * (components/docs-search.tsx). Relays `api.searchDocs()` (Web API
 * `/docs/search`), which matches titles, headings and body text and points
 * each hit at its best section.
 */
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (!q) return NextResponse.json([]);
  try {
    return NextResponse.json(await api.searchDocs(q, 8));
  } catch {
    // Best-effort, like the site typeahead: no suggestions beats an error.
    return NextResponse.json([]);
  }
}
