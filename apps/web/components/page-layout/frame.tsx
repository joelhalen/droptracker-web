/**
 * Layout chrome shared by group pages and player profiles (web137a): the
 * page-level theme wrapper, the 12-column grid, and the slot every block sits
 * in (width, surface, title, show-on, and the builder-preview markers).
 *
 * Server component. The theme is applied as inline --dt-* variables on the
 * layout wrapper only, so the site header and footer stay DropTracker's and
 * a group's colours never leak into the rest of the site.
 */
import { Suspense, type CSSProperties, type ReactNode } from "react";
import type { BlockSurface, BlockWidth, PageTheme } from "@droptracker/api-types";
import { SITE_THEMES } from "@/lib/site-themes";
import { ScrollPanel } from "@/components/scroll-panel";

const WIDTH_CLASS: Record<BlockWidth, string> = {
  full: "md:col-span-12",
  two_thirds: "md:col-span-8",
  half: "md:col-span-6",
  third: "md:col-span-4",
};

const HIDE_CLASS = { none: "", mobile: "hidden md:block", desktop: "md:hidden" } as const;

/** Surfaces drawn on light paper: their content needs dark ink. */
export const LIGHT_SURFACES: ReadonlySet<BlockSurface> = new Set(["parchment", "scroll"]);

export function themeStyle(theme: PageTheme): CSSProperties {
  const vars: Record<string, string> = {};
  if (theme.preset !== "default") Object.assign(vars, SITE_THEMES[theme.preset]);
  Object.assign(vars, theme.palette ?? {});
  return vars as CSSProperties;
}

export function LayoutFrame({
  theme,
  preview,
  children,
}: {
  theme: PageTheme;
  preview?: boolean;
  children: ReactNode;
}) {
  const bg = theme.background !== "default" ? `pl-bg-${theme.background}` : "";
  const ink = theme.background === "parchment" ? "pl-ink-light" : "";
  return (
    <div
      className={`space-y-8 ${bg} ${ink}`}
      style={themeStyle(theme)}
      {...(preview ? { "data-pl-preview": "" } : {})}
    >
      {children}
    </div>
  );
}

export function LayoutGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-12">{children}</div>;
}

function BlockTitle({ title, light }: { title: string; light: boolean }) {
  return (
    <h2
      className={`pl-block-title mb-3 pb-1 text-lg font-semibold ${
        light ? "ink-heading border-b border-current/20" : "heading-rule text-osrs-gold"
      }`}
    >
      {title}
    </h2>
  );
}

export function BlockSlot({
  id,
  label,
  width,
  surface,
  title,
  hideOn,
  preview,
  children,
}: {
  id: string;
  label: string;
  width: BlockWidth;
  surface: BlockSurface;
  title?: string | null;
  hideOn: "none" | "mobile" | "desktop";
  preview?: boolean;
  children: ReactNode;
}) {
  const light = LIGHT_SURFACES.has(surface);
  // Each block streams on its own: a slow data block (a PB board, the
  // lootboard) never holds up the rest of the page, or the builder preview.
  const body = (
    <>
      {title ? <BlockTitle title={title} light={light} /> : null}
      <Suspense fallback={<BlockSkeleton />}>{children}</Suspense>
    </>
  );
  let inner: ReactNode;
  switch (surface) {
    case "scroll":
      inner = <ScrollPanel className="pl-surface-scroll pl-ink-light">{body}</ScrollPanel>;
      break;
    case "parchment":
      inner = <div className="pl-surface-parchment pl-ink-light">{body}</div>;
      break;
    case "window":
      // The game's interface window (components/osrs-panel OsrsWindow): the
      // heading lives in the title bar.
      inner = (
        <div className="border-osrs-bronze/60 bg-osrs-surface-1 overflow-hidden rounded-md border-2 shadow-lg">
          <div className="border-osrs-bronze/50 bg-osrs-surface-3 border-b px-3 py-2">
            <h2 className="font-osrs text-osrs-gold-bright text-lg leading-none tracking-wide">{title || label}</h2>
          </div>
          <div className="p-4">
            <Suspense fallback={<BlockSkeleton />}>{children}</Suspense>
          </div>
        </div>
      );
      break;
    case "card":
    case "stone":
    case "panel":
      inner = <div className={`pl-surface-${surface}`}>{body}</div>;
      break;
    default:
      inner = body;
  }
  return (
    <section
      data-pl-slot=""
      className={`rise-in min-w-0 ${WIDTH_CLASS[width]} ${preview ? "" : HIDE_CLASS[hideOn]}`}
      {...(preview
        ? {
            "data-block-id": id,
            "data-block-label": hideOn === "none" ? label : `${label} (${hideOn === "mobile" ? "desktop only" : "phone only"})`,
          }
        : {})}
    >
      {inner}
    </section>
  );
}

function BlockSkeleton() {
  return <div className="bg-osrs-surface-2/60 h-28 animate-pulse rounded-lg" aria-hidden />;
}

const BANNER_MIN_HEIGHT = { sm: "min-h-28 sm:min-h-32", md: "min-h-36 sm:min-h-48", lg: "min-h-48 sm:min-h-72" } as const;

/**
 * The banner header (group pages and profiles). Height grows with its
 * content, so a long name that wraps on a phone is never clipped. The
 * fallback gradient and the text colours are fixed rather than taken from
 * the page palette: they sit on a dark photo-style scrim, and a light palette
 * (Parchment) would otherwise turn the banner white under a gold title.
 */
export function BannerFrame({
  theme,
  children,
  aside,
}: {
  theme: PageTheme;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="rise-in">
      <div
        className={`relative flex items-end overflow-hidden rounded-2xl border border-black/40 ${BANNER_MIN_HEIGHT[theme.banner_height]}`}
        style={
          theme.banner_url
            ? { backgroundImage: `url(${JSON.stringify(theme.banner_url)})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: "linear-gradient(135deg, #4a3f30 0%, #231c14 60%, #15110c 100%)" }
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <div
          className="relative flex w-full flex-wrap items-end justify-between gap-3 p-4 pt-16 sm:p-6 sm:pt-20"
          style={{ "--dt-gold": "#ffb83f", "--dt-text": "#f4ecdb", "--dt-text-muted": "#e0d4b8" } as CSSProperties}
        >
          {children}
          {aside}
        </div>
      </div>
    </header>
  );
}

/**
 * Returned by a data block that loads its own data and found nothing to
 * show. The page can't know that before the block renders, so the marker
 * does the hiding: visitors never see the block's slot at all (CSS
 * `:has()` in globals.css), the builder preview shows the hint instead.
 */
export function BlockEmpty({ hint }: { hint: string }) {
  return (
    <div data-pl-empty="" className="border-osrs-bronze/40 text-osrs-parchment-dark/70 rounded-lg border border-dashed px-4 py-5 text-center text-xs">
      {hint}
    </div>
  );
}

/** What the builder preview shows where a block has nothing to display yet.
 * Visitors never see it: the public render drops the block instead. */
export function PreviewPlaceholder({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="border-osrs-bronze/40 text-osrs-parchment-dark/70 rounded-lg border border-dashed px-4 py-6 text-center text-sm">
      <div className="font-medium">{label}</div>
      <div className="mt-1 text-xs opacity-80">{hint}</div>
    </div>
  );
}
