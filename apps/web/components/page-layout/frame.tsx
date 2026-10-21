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
