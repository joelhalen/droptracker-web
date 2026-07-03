"use client";

/**
 * User-switchable site themes (UI refresh). The palette lives entirely in CSS
 * (globals.css `[data-theme=…]` blocks); this module just flips the
 * `data-theme` attribute on <html> and persists the choice. A tiny inline
 * script in app/layout.tsx re-applies the stored theme before first paint so
 * there is no flash of the default palette.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export const THEME_STORAGE_KEY = "dt-theme";

export const THEMES = [
  {
    id: "dusk",
    label: "Gielinor Dusk",
    hint: "The classic dark bronze & gold",
    /** Preview swatches: [canvas, accent] of the target theme. */
    swatch: ["#211a12", "#ffb83f"],
  },
  {
    id: "parchment",
    label: "Parchment",
    hint: "Bright paper-and-ink light mode",
    swatch: ["#f6efdd", "#8a5f04"],
  },
  {
    id: "wilderness",
    label: "Wilderness",
    hint: "Near-black lit by ember and red",
    swatch: ["#141316", "#ff5c33"],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export function isThemeId(value: string | undefined | null): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

/** Inline `<script>` body that applies the stored theme pre-paint (no flash). */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="dusk"||t==="parchment"||t==="wilderness")document.documentElement.dataset.theme=t}catch(e){}`;

export function useTheme() {
  // Render "dusk" on the server/first client pass (matches the SSR markup),
  // then sync to whatever the init script applied.
  const [theme, setThemeState] = useState<ThemeId>("dusk");

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (isThemeId(current)) setThemeState(current);
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    document.documentElement.dataset.theme = id;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      /* private browsing — theme still applies for this page view */
    }
  }, []);

  return { theme, setTheme };
}

/** Two-dot preview of a theme's canvas + accent colors. */
function Swatch({ colors }: { colors: readonly [string, string] | readonly string[] }) {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {colors.map((c) => (
        <span
          key={c}
          className="border-osrs-bronze/40 size-3 rounded-full border"
          style={{ backgroundColor: c }}
        />
      ))}
    </span>
  );
}

/**
 * Compact palette dropdown for the site header. Opens on hover or click,
 * closes on outside click / Escape.
 */
export function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Change theme"
        title="Change theme"
        onClick={() => setOpen((o) => !o)}
        className="hover:bg-osrs-bronze/30 text-osrs-parchment-dark/80 hover:text-osrs-gold-bright flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors"
      >
        {/* Palette glyph */}
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 1.4-3.4 2 2 0 0 1 1.4-3.4H19a3 3 0 0 0 3-3c0-4.5-4.5-8.2-10-8.2Z" />
          <circle cx="7.5" cy="11.5" r="1" fill="currentColor" />
          <circle cx="11" cy="7.5" r="1" fill="currentColor" />
          <circle cx="15.5" cy="8.5" r="1" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div role="menu" className="card-pop menu-in absolute right-0 top-full z-50 w-56 p-1.5">
          <div className="text-osrs-parchment-dark/60 px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider">
            Theme
          </div>
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="menuitemradio"
              aria-checked={theme === t.id}
              onClick={() => {
                setTheme(t.id);
                setOpen(false);
              }}
              className={`hover:bg-osrs-bronze/25 flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                theme === t.id ? "text-osrs-gold-bright" : ""
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Swatch colors={t.swatch} />
                {t.label}
              </span>
              {theme === t.id && <span aria-hidden>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Full-size theme cards for the settings page — same state, bigger preview
 * and description per theme.
 */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Site theme" className="grid gap-3 sm:grid-cols-3">
      {THEMES.map((t) => {
        const active = theme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(t.id)}
            className={`cursor-pointer rounded-xl border p-4 text-left transition-colors ${
              active
                ? "border-osrs-gold/70 bg-osrs-surface-2"
                : "border-osrs-bronze/30 hover:border-osrs-gold/40 bg-osrs-surface-1"
            }`}
          >
            <div className="flex items-center justify-between">
              <Swatch colors={t.swatch} />
              {active && <span className="text-osrs-gold-bright text-xs font-semibold">Active</span>}
            </div>
            <div className="mt-2 font-medium">{t.label}</div>
            <div className="text-osrs-parchment-dark/70 mt-0.5 text-xs">{t.hint}</div>
          </button>
        );
      })}
    </div>
  );
}
