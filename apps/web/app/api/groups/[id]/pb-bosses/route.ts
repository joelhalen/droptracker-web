/**
 * Group PB boss index for the site builder's boss picker — the editor is a
 * client component and cannot call `lib/api` directly.
 */
import { NextResponse } from "next/server";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ bosses: [] }, { status: 400 });
  }
  const index = await api.pbBosses(groupId).catch(() => null);
  return NextResponse.json(
    { bosses: index?.bosses ?? [] },
    { headers: { "cache-control": "private, max-age=60" } },
  );
}
