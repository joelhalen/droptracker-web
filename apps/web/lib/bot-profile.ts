/**
 * Pure helpers for the custom bot profile surfaces (web139a).
 */
const IMAGE_KEYS = ["avatar_url", "banner_url"] as const;

export function botProfileImages(raw: string | null): { key: string; url: string }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return IMAGE_KEYS.flatMap((key) => {
      const url = parsed[key];
      return typeof url === "string" && /^https?:\/\//.test(url) ? [{ key, url }] : [];
    });
  } catch {
    return [];
  }
}
