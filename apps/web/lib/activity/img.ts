/**
 * Icon URL helpers for the Discord Activity — always relative `/img` so every
 * asset stays same-origin under the iframe CSP (the activity host proxies
 * `/img/` in nginx; www serves the identical paths). Mirrors the site-wide
 * `${IMG_BASE}/{itemdb,npcdb,metrics}` convention (see bingo-tile.tsx).
 *
 * Discord avatars are the one exception: Discord's own CDN is CSP-exempt
 * inside activities, so those load directly from cdn.discordapp.com.
 */
export const itemIcon = (id: number): string => `/img/itemdb/${id}.png`;
export const npcIcon = (id: number): string => `/img/npcdb/${id}.png`;
export const metricIcon = (name: string): string =>
  `/img/metrics/${name.toLowerCase().replace(/ /g, "_")}.png`;

/** Discord CDN avatar for a user; deterministic default when they have none. */
export function discordAvatar(userId: string, hash: string | null | undefined, size = 64): string {
  if (hash) {
    const ext = hash.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${userId}/${hash}.${ext}?size=${size}`;
  }
  let index = 0;
  try {
    index = Number((BigInt(userId) >> 22n) % 6n);
  } catch {
    /* non-numeric id — keep default 0 */
  }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}
