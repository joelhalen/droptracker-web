/**
 * The one stable link to the current plugin test build.
 *
 * This handler never streams bytes. It asks the Web API whether this session
 * may download (Bug Testers and staff only), which also records the download,
 * and then answers with an `X-Accel-Redirect` header. nginx sees that header
 * and serves the zip itself from an `internal` location that cannot be
 * requested directly. So the file has no public URL, and Node never holds a
 * 28 MB response open.
 *
 * Every response here, redirects included, is `private, no-store`. The path
 * ends in .zip and sits behind Cloudflare, which caches that extension by
 * default: one cached answer would hand the build, or a stale redirect, to
 * someone who is not signed in.
 *
 * It lives outside the (site) group because it is a file, not a page, and
 * middleware skips it for the same reason (paths with a file extension).
 */
import { NextResponse, type NextRequest } from "next/server";
import { env, SESSION_COOKIE } from "@/lib/env";
import {
  DOWNLOAD_CACHE_CONTROL,
  accelHeaders,
  downloadResponsePlan,
  loginPath,
  pagePath,
} from "@/lib/tester-builds";

export const dynamic = "force-dynamic";

/** Redirects are built from the configured site URL, never the request's Host
 *  header, so a forged Host cannot turn this into an open redirect. */
function redirectTo(path: string): Response {
  return NextResponse.redirect(new URL(path, env.siteUrl), {
    status: 302,
    headers: { "Cache-Control": DOWNLOAD_CACHE_CONTROL },
  });
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return redirectTo(loginPath);

  // Mock mode has no build to serve, and must not record a download against a
  // real backend that happens to be reachable from a dev server.
  if (env.useMockApi) return redirectTo(pagePath);

  let status: number;
  let body: unknown = null;
  try {
    const upstream = await fetch(`${env.webApiInternalUrl}/api/v1/tester-builds/download`, {
      method: "POST",
      headers: { accept: "application/json", cookie: `${SESSION_COOKIE}=${token}` },
      cache: "no-store",
    });
    status = upstream.status;
    if (status === 200) body = await upstream.json();
    // An unread body holds its socket until it is collected, and nothing in
    // an error body changes where the visitor goes.
    else void upstream.body?.cancel().catch(() => undefined);
  } catch {
    // Backend unreachable or a body that is not JSON. The page is the place
    // that can explain what is wrong, so send the visitor there.
    return redirectTo(pagePath);
  }

  const plan = downloadResponsePlan(status, body);
  if (plan.kind === "login") return redirectTo(loginPath);
  if (plan.kind === "page") {
    if (status === 200) {
      // The API recorded a download but named a file we will not serve. That
      // is a publishing bug, not a visitor problem, so make it findable.
      console.error("[dl/bugtest.zip] refused the file name from the Web API");
    }
    return redirectTo(pagePath);
  }
  return new Response(null, { status: 200, headers: accelHeaders(plan.file) });
}

/**
 * Answered here so a HEAD never reaches the Web API. Without this export Next
 * runs GET for a HEAD request, and every link preview or download manager
 * probing the URL would be recorded as a download.
 */
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: { "Content-Type": "application/zip", "Cache-Control": DOWNLOAD_CACHE_CONTROL },
  });
}
