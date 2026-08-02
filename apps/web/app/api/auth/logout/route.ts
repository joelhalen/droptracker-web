import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { env, SESSION_COOKIE } from "@/lib/env";
import { clearSession, safeReturnPath } from "@/lib/session";

/**
 * Sign-out is a state change, so it is POST-only. A logout implemented as a
 * side-effectful GET is fired involuntarily — Next.js `<Link>` prefetch, browser
 * link scanners, anti-virus prefetchers — and the browser still applies the
 * session-clearing `Set-Cookie` from that "invisible" request. That silently
 * destroyed a just-issued session on the next render and bounced the user back
 * into the Discord OAuth loop. GET therefore never touches the session.
 */
export async function POST(req: NextRequest) {
  // Revoke server-side before dropping the cookie. Deleting the cookie only
  // stops THIS browser from sending the token — the JWT itself stays valid for
  // its full TTL, so anyone who captured it (a copied browser profile, a proxy
  // log, an extension) could keep using it for days after a sign-out. The
  // backend already has the deny-list; nothing was calling it.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await fetch(`${env.webApiInternalUrl}/api/v1/auth/logout`, {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE}=${token}` },
        cache: "no-store",
      });
    } catch {
      // Best effort: a backend hiccup must not trap someone in a session they
      // asked to leave. The cookie still goes.
    }
  }
  await clearSession();
  const redirectTo = safeReturnPath(req.nextUrl.searchParams.get("redirect"));
  // 303 so the browser follows with a GET after the POST.
  return NextResponse.redirect(new URL(redirectTo, env.siteUrl), 303);
}

export async function GET(req: NextRequest) {
  const redirectTo = safeReturnPath(req.nextUrl.searchParams.get("redirect"));
  return NextResponse.redirect(new URL(redirectTo, env.siteUrl));
}
