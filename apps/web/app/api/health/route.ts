/**
 * Liveness/readiness probe for zero-downtime blue-green deploys. deploy-web.sh
 * polls this on the freshly-restarted (idle) instance's port and only flips
 * nginx traffic to it once this returns 200 — so the new build is fully booted
 * before it receives any user traffic. Intentionally dependency-free (no DB /
 * backend call): it answers "is this Next process up and serving?", nothing more.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } },
  );
}
