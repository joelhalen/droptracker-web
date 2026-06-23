/**
 * BFF: lightweight session probe for client components (the auth-aware nav).
 * Keeps the public layout static while the nav island hydrates auth state.
 */
import { NextResponse } from "next/server";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await api.me();
  return NextResponse.json(me, {
    headers: { "cache-control": "private, no-store" },
  });
}
