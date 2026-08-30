/**
 * BFF: streams a player's character model from the image tree.
 *
 * The renderer fetches models with `fetch`, which is subject to CORS. Serving
 * them through this route makes the model same-origin with whatever page is
 * drawing it — the profile, the chrome-less render page under headless
 * chromium, the Discord Activity iframe, or a group site on its own subdomain.
 * Pointing the browser straight at the image host works only in the one case
 * where they happen to share an origin, and fails silently everywhere else:
 * the model just never loads and the canvas stays empty.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const IMG_BASE = process.env.IMG_BASE_URL ?? "https://www.droptracker.io/img";

/**
 * Models moved to B2 behind the CDN (2026-08-30) under `dt_img/models/…`, so
 * that host is tried first; the legacy image host stays as the fallback (it
 * serves any not-yet-migrated file directly, and 302s to the CDN otherwise,
 * which `fetch` follows — so the fallback works in every transition state).
 */
const MODELS_CDN_BASE =
  process.env.MODELS_CDN_BASE_URL ?? "https://video.droptracker.io/dt_img";

/** Hex, as written by the plugin. Never interpolated into a URL unchecked. */
const FINGERPRINT_RE = /^[0-9a-f]{1,32}(-pet)?$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ playerId: string; fingerprint: string }> },
) {
  const { playerId, fingerprint } = await params;
  const id = Number(playerId);

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "bad player id" }, { status: 400 });
  }
  if (!FINGERPRINT_RE.test(fingerprint)) {
    return NextResponse.json({ error: "bad fingerprint" }, { status: 400 });
  }

  const upstreams = [
    `${MODELS_CDN_BASE}/models/${id}/${fingerprint}.glb`,
    `${IMG_BASE}/models/${id}/${fingerprint}.glb`,
  ];

  let sawNetworkError = false;
  for (const upstream of upstreams) {
    try {
      const res = await fetch(upstream, { cache: "no-store" });
      if (!res.ok) {
        continue;
      }
      return new NextResponse(res.body, {
        headers: {
          "content-type": "model/gltf-binary",
          // Immutable in practice: the fingerprint changes when the model does.
          "cache-control": "public, max-age=86400, immutable",
        },
      });
    } catch {
      sawNetworkError = true;
    }
  }
  return sawNetworkError
    ? NextResponse.json({ error: "unavailable" }, { status: 502 })
    : NextResponse.json({ error: "not found" }, { status: 404 });
}
