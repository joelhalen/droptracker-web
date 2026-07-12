/**
 * Runtime redirect resolution.
 *
 * Middleware runs before routing and before the static `next.config.ts`
 * redirect map, so it is where the admin-configurable (DB-backed) redirects are
 * applied. It runs in the Edge runtime and therefore cannot touch the DB or
 * import `lib/api` directly — instead it fetches the cached internal route
 * handler `/api/redirects`, which reads the Web API and is invalidated
 * instantly by the admin server actions (`revalidateTag("redirects")`). A tiny
 * module-scope memo keeps this from being a subrequest on every navigation.
 *
 * Precedence: a DB redirect that matches here shadows the static map. The
 * static legacy 301s in `next.config.ts` remain as the fallback layer.
 */
import { NextResponse, type NextRequest } from "next/server";
import { type RedirectRule } from "@/lib/redirects";
import { resolveRedirect } from "@/lib/redirect-resolver";

export const config = {
  // Skip Next internals, BFF API routes, and any path with a file extension.
  matcher: ["/((?!_next/|api/|.*\\.[\\w]+$).*)"],
};

const MEMO_TTL_MS = 10_000;
let memo: { rules: RedirectRule[]; at: number } | null = null;

async function loadRules(origin: string): Promise<RedirectRule[]> {
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) return memo.rules;
  try {
    const res = await fetch(new URL("/api/redirects", origin), { cache: "no-store" });
    if (!res.ok) throw new Error(`redirects endpoint ${res.status}`);
    const rules = (await res.json()) as RedirectRule[];
    memo = { rules, at: Date.now() };
    return rules;
  } catch {
    // Never break navigation because the rule source is unavailable — serve the
    // last known set if we have one, otherwise pass through.
    return memo?.rules ?? [];
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search, origin } = req.nextUrl;

  const rules = await loadRules(origin);
  if (rules.length === 0) return NextResponse.next();

  const hit = resolveRedirect(pathname, search.replace(/^\?/, ""), rules);
  if (!hit) return NextResponse.next();

  const target = hit.destination.startsWith("/")
    ? new URL(hit.destination, origin)
    : new URL(hit.destination);
  return NextResponse.redirect(target, hit.status);
}
