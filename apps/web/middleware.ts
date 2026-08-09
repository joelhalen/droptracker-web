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

/** Tenant mini-sites domain; see next.config.ts. Empty = surface disabled. */
const SITES_DOMAIN = process.env.SITES_DOMAIN ?? "";

/**
 * CSP hash for the root layout's pre-paint theme script. It is emitted into
 * statically-prerendered HTML, so it cannot carry a per-request nonce — and
 * reading headers() in the root layout to nonce it would force the whole main
 * site dynamic. A hash allows exactly that script and nothing else.
 * Lazily computed from the real constant so it can never drift.
 */
import { THEME_INIT_SCRIPT } from "@/components/theme";
let themeScriptHash: string | null = null;
async function getThemeScriptHash(): Promise<string> {
  if (themeScriptHash) return themeScriptHash;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(THEME_INIT_SCRIPT),
  );
  themeScriptHash = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return themeScriptHash;
}

function isTenantHost(host: string | null): boolean {
  if (!SITES_DOMAIN || !host) return false;
  const bare = host.split(":")[0] ?? host;
  return bare === SITES_DOMAIN || bare.endsWith("." + SITES_DOMAIN);
}

export async function middleware(req: NextRequest) {
  const { pathname, search, origin } = req.nextUrl;

  // Group mini-sites on *.SITES_DOMAIN: skip the (host-blind, droptracker.io
  // -scoped) DB redirect rules entirely, and attach the tenant CSP. The nonce
  // is set on the REQUEST CSP header so Next tags its own inline bootstrap
  // scripts with it; the RESPONSE ships Report-Only until the policy has
  // soaked on dev, then flips to enforcing via SITES_CSP_ENFORCE=1.
  if (isTenantHost(req.headers.get("host"))) {
    const nonce = btoa(crypto.randomUUID());
    const themeHash = await getThemeScriptHash();
    const csp = [
      "default-src 'none'",
      `script-src 'nonce-${nonce}' 'sha256-${themeHash}' 'strict-dynamic' 'self'`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://www.droptracker.io https://videos.droptracker.io",
      "media-src https://videos.droptracker.io",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");
    const reqHeaders = new Headers(req.headers);
    reqHeaders.set("content-security-policy", csp);
    reqHeaders.set("x-nonce", nonce);
    const res = NextResponse.next({ request: { headers: reqHeaders } });
    const enforce = process.env.SITES_CSP_ENFORCE === "1";
    res.headers.set(
      enforce ? "content-security-policy" : "content-security-policy-report-only",
      csp,
    );
    return res;
  }

  const rules = await loadRules(origin);
  if (rules.length === 0) return NextResponse.next();

  const hit = resolveRedirect(pathname, search.replace(/^\?/, ""), rules);
  if (!hit) return NextResponse.next();

  const target = hit.destination.startsWith("/")
    ? new URL(hit.destination, origin)
    : new URL(hit.destination);
  return NextResponse.redirect(target, hit.status);
}
