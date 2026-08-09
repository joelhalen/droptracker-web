/**
 * Server-side `--dt-*` theme presets for tenant mini-sites (sites-v1).
 *
 * These replicate the three `data-theme` palettes in `app/globals.css`.
 * Tenant pages can't rely on the client ThemeProvider (theme must be
 * server-driven from the site's config, and the visitor's localStorage
 * preference for droptracker.io must NOT restyle someone's clan site), so the
 * tenant layout sets these variables inline on a wrapper element — CSS
 * inheritance means the nearer ancestor beats the `:root[data-theme]` block
 * for everything inside.
 *
 * If globals.css gains/changes a theme, mirror it here (single source for the
 * site builder's theme picker too).
 */

export const SITE_THEME_KEYS = ["dusk", "parchment", "wilderness"] as const;
export type SiteThemeKey = (typeof SITE_THEME_KEYS)[number];

type ThemeVars = Record<string, string>;

const dusk: ThemeVars = {
  "--dt-text": "#efe6d2",
  "--dt-text-muted": "#d8c9a3",
  "--dt-brown": "#3e3529",
  "--dt-brown-dark": "#28221a",
  "--dt-bronze": "#7a5a32",
  "--dt-gold": "#ffb83f",
  "--dt-gold-bright": "#ffd966",
  "--dt-red": "#e05c4d",
  "--dt-green": "#6fbf73",
  "--dt-stone": "#5a5a52",
  "--dt-surface-0": "#15110c",
  "--dt-surface-1": "#211a12",
  "--dt-surface-2": "#2c2318",
  "--dt-surface-3": "#3a2f20",
  "--dt-ember": "#ff8c42",
  "--dt-glow": "#3e3529",
  "--dt-shadow-card": "0 1px 2px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.35)",
  "--dt-shadow-pop": "0 4px 12px rgba(0, 0, 0, 0.45), 0 16px 40px rgba(0, 0, 0, 0.4)",
};

const parchment: ThemeVars = {
  "--dt-text": "#2e2618",
  "--dt-text-muted": "#5c4e34",
  "--dt-brown": "#e5d8ba",
  "--dt-brown-dark": "#3a2f1c",
  "--dt-bronze": "#a07b42",
  "--dt-gold": "#8a5f04",
  "--dt-gold-bright": "#a3730a",
  "--dt-red": "#b3372a",
  "--dt-green": "#2f7d32",
  "--dt-stone": "#8a8574",
  "--dt-surface-0": "#ece0c6",
  "--dt-surface-1": "#f6efdd",
  "--dt-surface-2": "#fdf8ec",
  "--dt-surface-3": "#fffdf6",
  "--dt-ember": "#c85a17",
  "--dt-glow": "#f9f3e2",
  "--dt-shadow-card": "0 1px 2px rgba(74, 58, 28, 0.1), 0 8px 24px rgba(74, 58, 28, 0.12)",
  "--dt-shadow-pop": "0 4px 12px rgba(74, 58, 28, 0.18), 0 16px 40px rgba(74, 58, 28, 0.16)",
};

const wilderness: ThemeVars = {
  "--dt-text": "#e8e4dc",
  "--dt-text-muted": "#b3ada0",
  "--dt-brown": "#2b2326",
  "--dt-brown-dark": "#171214",
  "--dt-bronze": "#7a4a3a",
  "--dt-gold": "#ff8a45",
  "--dt-gold-bright": "#ffb066",
  "--dt-red": "#e0574a",
  "--dt-green": "#74c777",
  "--dt-stone": "#56565e",
  "--dt-surface-0": "#0b0b0d",
  "--dt-surface-1": "#141316",
  "--dt-surface-2": "#1d1b1f",
  "--dt-surface-3": "#29262b",
  "--dt-ember": "#ff5c33",
  "--dt-glow": "#2b2326",
  "--dt-shadow-card": "0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.45)",
  "--dt-shadow-pop": "0 4px 12px rgba(0, 0, 0, 0.55), 0 16px 40px rgba(0, 0, 0, 0.5)",
};

export const SITE_THEMES: Record<SiteThemeKey, ThemeVars> = { dusk, parchment, wilderness };

/**
 * Inline style for the tenant wrapper: preset vars for `theme_key` (default
 * dusk) overlaid with the site's saved palette overrides. Palette values are
 * validated server-side at save (`web_api/sites_shared.py palette_value_ok`),
 * so they are safe to inline.
 */
export function sitePaletteStyle(
  themeKey: string | undefined,
  palette: Record<string, string> | undefined,
): Record<string, string> {
  const preset = SITE_THEMES[(themeKey as SiteThemeKey) ?? "dusk"] ?? SITE_THEMES.dusk;
  return { ...preset, ...(palette ?? {}) };
}
