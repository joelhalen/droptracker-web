/**
 * The tester client's own updater (the launch script in a downloaded build).
 *
 *   GET  ?have=<build id>  is there a newer build than the one in this folder?
 *   POST                   download the current build (recorded as a download)
 *
 * There is no session here. A downloaded build carries an update key in its
 * tester.properties, sent as `Authorization: Bearer dtu_...`, and the Web API
 * decides everything from that key: whether it is still good, whether its
 * owner is still a Bug Tester, and what to record. This handler only passes
 * the key on and, for a download, hands the checked file name to nginx the
 * same way /dl/bugtest.zip does.
 *
 * The path has no file extension on purpose: Cloudflare caches .zip by
 * default, and every answer here is `private, no-store` as well.
 */
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { DOWNLOAD_CACHE_CONTROL, accelHeaders, downloadResponsePlan } from "@/lib/tester-builds";

export const dynamic = "force-dynamic";

const UPSTREAM = "/api/v1/tester-builds/update";
const KEY_HEADER = /^Bearer dtu_[A-Za-z0-9_-]{1,96}$/;
const BUILD_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;

function problem(status: number, code: string, detail: string): Response {
  return NextResponse.json(
    { status, code, detail },
    { status, headers: { "Cache-Control": DOWNLOAD_CACHE_CONTROL } },
  );
}

/** The key, or null when the header is anything but a well-formed one. */
function keyHeader(req: NextRequest): string | null {
  const value = req.headers.get("authorization")?.trim() ?? "";
  return KEY_HEADER.test(value) ? value : null;
}

const badKey = () =>
  problem(401, "update_key_invalid", "This test client has no working update key.");

async function upstream(path: string, method: "GET" | "POST", key: string) {
  return fetch(`${env.webApiInternalUrl}${path}`, {
    method,
    headers: { accept: "application/json", authorization: key },
    cache: "no-store",
  });
}

export async function GET(req: NextRequest) {
  const key = keyHeader(req);
  if (!key) return badKey();
  if (env.useMockApi) return problem(503, "unavailable", "Updates are not available here.");
  const have = req.nextUrl.searchParams.get("have") ?? "";
  const query = BUILD_ID.test(have) ? `?have=${encodeURIComponent(have)}` : "";
  try {
    const res = await upstream(UPSTREAM + query, "GET", key);
    // Passed through as it is: the updater reads `update` and `current`, or
    // the problem's `code` and `detail`.
    return new Response(await res.text(), {
      status: res.status,
      headers: { "Content-Type": "application/json", "Cache-Control": DOWNLOAD_CACHE_CONTROL },
    });
  } catch {
    return problem(502, "unavailable", "The update check is not available right now.");
  }
}

export async function POST(req: NextRequest) {
  const key = keyHeader(req);
  if (!key) return badKey();
  if (env.useMockApi) return problem(503, "unavailable", "Updates are not available here.");
  let status: number;
  let body: unknown = null;
  try {
    const res = await upstream(`${UPSTREAM}/download`, "POST", key);
    status = res.status;
    body = await res.json().catch(() => null);
  } catch {
    return problem(502, "unavailable", "The download is not available right now.");
  }
  if (status !== 200) {
    const detail = (body as { detail?: unknown } | null)?.detail;
    const code = (body as { code?: unknown } | null)?.code;
    return problem(
      status,
      typeof code === "string" ? code : "unavailable",
      typeof detail === "string" ? detail : "The download is not available right now.",
    );
  }
  const plan = downloadResponsePlan(200, body);
  if (plan.kind !== "accel") {
    // Recorded, but named a file we will not serve: a publishing bug.
    console.error("[api/tester-builds/update] refused the file name from the Web API");
    return problem(502, "unavailable", "The download is not available right now.");
  }
  return new Response(null, { status: 200, headers: accelHeaders(plan.file, plan.saveAs) });
}
