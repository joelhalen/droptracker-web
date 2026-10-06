/**
 * BFF door for the owner's Android admin widget.
 *
 * Forwards the phone's `Authorization: Bearer dtw_...` device token to the Web
 * API's token-gated summary (web_api/routes/admin_widget.py), which is the only
 * endpoint that accepts one. Nothing here reads cookies, and nothing is cached:
 * the payload is per-token and private.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };

const SummarySchema = z.object({
  generated_at: z.number(),
  user_id: z.number(),
  support: z.record(z.string(), z.unknown()).nullable(),
  business: z.record(z.string(), z.unknown()).nullable(),
  dev: z.record(z.string(), z.unknown()).nullable(),
});

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!/^Bearer dtw_[\w-]+$/.test(auth.trim())) {
    return NextResponse.json(
      { error: "widget token required", code: "widget_token_required" },
      { status: 401, headers: NO_STORE },
    );
  }
  try {
    const res = await fetch(`${env.webApiInternalUrl}/api/v1/admin/widget/summary`, {
      headers: { accept: "application/json", authorization: auth.trim() },
      cache: "no-store",
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      // 401/403 carry the stable `code` the app branches on (revoked vs demoted).
      return NextResponse.json(body ?? { error: "upstream error" }, {
        status: res.status,
        headers: NO_STORE,
      });
    }
    return NextResponse.json(SummarySchema.passthrough().parse(body), { headers: NO_STORE });
  } catch (err) {
    console.error("[widget/admin]", err);
    return NextResponse.json({ error: "upstream error" }, { status: 502, headers: NO_STORE });
  }
}
