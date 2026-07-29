/**
 * BFF: proof-screenshot upload from the Discord Activity (web75a) — the bearer
 * twin of the site's `app/api/uploads/proof`. The Activity has no cookies, so
 * the session arrives as a bearer and is translated into `dt_session` here; the
 * Web API does the real work (Pillow validation, 10 MB cap, server-side B2 put)
 * and returns `{ key, public_url }`.
 *
 * Multipart, so it can't use `upstreamForward` (JSON-only): the incoming
 * FormData is re-posted so fetch sets its own multipart boundary.
 */
import { NextResponse, type NextRequest } from "next/server";
import { env, SESSION_COOKIE } from "@/lib/env";
import { bearerFrom } from "@/app/api/activity/_lib";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const bearer = bearerFrom(req);
  if (!bearer) {
    return NextResponse.json({ detail: "Sign in to upload a screenshot." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ detail: "Expected a multipart form upload." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ detail: "No image was provided." }, { status: 400 });
  }

  const outbound = new FormData();
  outbound.set("file", file);

  try {
    const res = await fetch(`${env.webApiInternalUrl}/api/v1/uploads/proof`, {
      method: "POST",
      headers: { accept: "application/json", cookie: `${SESSION_COOKIE}=${bearer}` },
      body: outbound,
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch (err) {
    console.error("[activity/uploads/proof]", err);
    return NextResponse.json({ detail: "Couldn't upload the image." }, { status: 502 });
  }
}
