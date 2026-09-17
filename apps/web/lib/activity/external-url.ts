/**
 * The public address behind a link the Discord Activity holds, for handing to
 * the SDK's `openExternalLink`.
 *
 * The Activity BFF rewrites asset URLs so they load under the discordsays
 * iframe's CSP: `https://www.droptracker.io/img/...` becomes the relative
 * `/img/...`, and B2-hosted screenshots become the same-origin
 * `/api/activity/board-img?u=<original>` proxy. Both are right for an `<img>`
 * and wrong for "open this outside Discord": Discord needs an absolute URL, and
 * a relative one would resolve against the discordsays proxy host. This maps
 * them back.
 *
 * Kept free of the SDK import so it can be unit-tested.
 */
export const SITE_ORIGIN = "https://www.droptracker.io";

/** The same-origin image proxy (`app/api/activity/board-img`). */
const IMG_PROXY_PATH = "/api/activity/board-img";

function absoluteHttp(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
}

/** The URL to open for `url`, or null when there is nothing safe to open
 * (empty, a non-http scheme, or a proxy wrapping something that isn't an
 * absolute URL). */
export function externalUrl(url: string | null | undefined): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  // A same-origin path — but not a protocol-relative "//host/..." one.
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    const local = new URL(raw, SITE_ORIGIN);
    if (local.pathname === IMG_PROXY_PATH) {
      // The proxy only ever wraps an absolute URL, so no recursion: a nested
      // proxy path in `u` is not one of ours and opens nothing.
      return absoluteHttp(local.searchParams.get("u") ?? "");
    }
    return local.href;
  }
  return absoluteHttp(raw);
}
