import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
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
  await clearSession();
  const redirectTo = safeReturnPath(req.nextUrl.searchParams.get("redirect"));
  // 303 so the browser follows with a GET after the POST.
  return NextResponse.redirect(new URL(redirectTo, env.siteUrl), 303);
}

export async function GET(req: NextRequest) {
  const redirectTo = safeReturnPath(req.nextUrl.searchParams.get("redirect"));
  return NextResponse.redirect(new URL(redirectTo, env.siteUrl));
}
