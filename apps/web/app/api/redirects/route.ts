/**
 * BFF: the redirect rule set consumed by `middleware.ts`.
 *
 * Middleware (Edge) can't reach the Web API through `lib/api` (cookies/Node),
 * so this Node route handler is the door. The upstream read is wrapped in
 * `unstable_cache` under the tag `"redirects"`: the admin server actions call
 * `revalidateTag("redirects")` after any write, so edits go live on the next
 * request, with a 60s TTL as a safety net. Returns enabled rules only.
 */
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

const getRules = unstable_cache(async () => api.redirects(), ["site-redirects"], {
  tags: ["redirects"],
  revalidate: 60,
});

export async function GET() {
  const rules = await getRules();
  return NextResponse.json(rules);
}
