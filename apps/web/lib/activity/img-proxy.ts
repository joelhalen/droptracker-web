/**
 * Image addresses the Discord Activity iframe can load.
 *
 * The discordsays.com iframe's CSP only allows same-origin requests. The
 * activity host proxies `/img/` in nginx, so `https://www.droptracker.io/img/...`
 * becomes the relative `/img/...`. Everything else we host (B2 screenshots and
 * board art on video(s).droptracker.io, other www paths) goes through the
 * host-allowlisted `/api/activity/board-img` proxy.
 *
 * Pure and dependency-free so both the BFF (`app/api/activity/_lib.ts`) and
 * client components (through the embed host) share one mapping, and so it can
 * be unit-tested.
 */

/** The same-origin image proxy route (`app/api/activity/board-img`). */
export const IMG_PROXY_PATH = "/api/activity/board-img";

/** Hosts the same-origin proxy may fetch from. Prod `B2_CDN_BASE_URL` is
 * `https://video.droptracker.io` (SINGULAR); the plural is kept for the code
 * default and other envs. Sample art is on www. */
export const BOARD_IMG_HOSTS: ReadonlySet<string> = new Set([
  "video.droptracker.io",
  "videos.droptracker.io",
  "www.droptracker.io",
  "droptracker.io",
]);

/** Wrap an absolute URL on an allowlisted host in the proxy; anything else
 * (relative paths, other hosts, non-https) comes back unchanged. */
export function proxiedBoardImg(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.protocol !== "https:" || !BOARD_IMG_HOSTS.has(parsed.hostname)) return url;
  return `${IMG_PROXY_PATH}?u=${encodeURIComponent(url)}`;
}

/**
 * The address an `<img>` inside the Activity should use for `url`.
 *
 * `/img/...` on www (and on the bare domain) becomes relative, since nginx
 * serves it on the activity host for free; other allowlisted hosts go through
 * the proxy. Relative URLs, Discord's CDN (CSP-exempt in activities) and
 * unknown hosts are returned as they are.
 */
export function activityImgUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (
    parsed.protocol === "https:" &&
    (parsed.hostname === "www.droptracker.io" || parsed.hostname === "droptracker.io") &&
    parsed.pathname.startsWith("/img/")
  ) {
    return `${parsed.pathname}${parsed.search}`;
  }
  return proxiedBoardImg(url);
}
