/**
 * BFF: download one version of a file transfer (web95a).
 *
 * A byte proxy rather than a redirect. The stored objects have no public URL —
 * that is what makes an arbitrary-file drop-box safe to run — so the bytes come
 * back through the Web API, which re-checks the session and that the caller
 * owns the transfer (or is staff) before reading anything out of B2.
 *
 * Upstream owns the presentation headers: it decides Content-Type from an
 * allowlist and whether `?inline=1` is honoured (never for SVG/HTML). We copy
 * those through verbatim rather than deriving our own, so there is exactly one
 * place where a user-supplied filename or MIME type can reach a header.
 */
import type { NextRequest } from "next/server";
import { env, SESSION_COOKIE } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  const { id, version } = await params;
  const transferId = Number(id);
  const versionNumber = Number(version);
  if (!Number.isInteger(transferId) || !Number.isInteger(versionNumber)) {
    return new Response("bad request", { status: 400 });
  }

  const inline = req.nextUrl.searchParams.get("inline") === "1" ? "?inline=1" : "";
  const upstreamUrl =
    `${env.webApiInternalUrl}/api/v1/file-transfers/${transferId}` +
    `/versions/${versionNumber}/download${inline}`;
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
      signal: req.signal,
    });
  } catch {
    return new Response("storage unavailable", { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    // Surface the upstream's status (401/403/404) so the page can react;
    // the RFC-7807 body is not useful to a browser download, so drop it.
    return new Response(upstream.status === 404 ? "not found" : "unavailable", {
      status: upstream.status,
    });
  }

  const headers = new Headers();
  for (const key of ["content-type", "content-disposition", "content-length"]) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(upstream.body, { headers });
}
