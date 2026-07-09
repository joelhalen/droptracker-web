/**
 * BFF: compact group summary for hover cards. Reduces the full profile
 * (`api.group()`) to `GroupCard` (lib/entity-card.ts) — top players,
 * subscription tier flair, member count — fetched lazily by
 * `components/entity-hover-card.tsx`.
 */
import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";
import { toGroupCard } from "@/lib/entity-card";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ error: "bad group id" }, { status: 400 });
  }
  try {
    const card = toGroupCard(await api.group(groupId));
    return NextResponse.json(card, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 502;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
