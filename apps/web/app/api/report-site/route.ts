/**
 * BFF pass-through for anonymous site abuse reports (the /report form).
 * Forwards the client IP so the backend's per-IP rate limit sees the real
 * source, not the Next server.
 */
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { site?: string; reason?: string } | null;
  if (!body) return NextResponse.json({ detail: "Invalid body." }, { status: 422 });
  const ip =
    req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const res = await fetch(`${env.webApiInternalUrl}/api/v1/sites/report`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip },
    body: JSON.stringify({ site: body.site ?? "", reason: body.reason ?? "" }),
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: res.status });
}
