"use client";

/**
 * Shared active-aware tab/nav bar. Exact-match by default; pass
 * `matchPrefix: true` on tabs that own nested child routes (e.g. an "Events"
 * tab that should stay active on `/events/42`) — NOT on every tab, since a
 * root-ish tab like `/admin` is itself a path-prefix of every sibling tab and
 * would incorrectly light up alongside whichever sibling is actually active.
 */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";

export type NavTab = {
  href: string;
  label: string;
  matchPrefix?: boolean;
  locked?: boolean;
  /** Small count badge on the tab (e.g. pending review items). Shown when > 0. */
  badge?: number;
  /** Optional description shown under the label inside header dropdowns. */
  description?: string;
  /** Sub-links rendered as a dropdown (desktop) / indented list (mobile). */
  children?: NavTab[];
};

function isActive(pathname: string, tab: NavTab): boolean {
  if (pathname === tab.href) return true;
  return Boolean(tab.matchPrefix) && pathname.startsWith(`${tab.href}/`);
}

/** Tab text plus its lock/badge decorations — shared by the tab row and the
 * breadcrumb's dropdown so the two can't drift apart. */
function TabLabel({ tab }: { tab: NavTab }) {
  return (
    <>
      {tab.label}
      {tab.locked ? <span className="ml-1 opacity-70">🔒</span> : null}
      {tab.badge && tab.badge > 0 ? (
        <span className="bg-osrs-gold text-osrs-brown-dark ml-1.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold">
          {tab.badge > 99 ? "99+" : tab.badge}
        </span>
      ) : null}
    </>
  );
}

export function TabNav({ tabs, className = "" }: { tabs: NavTab[]; className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={`border-osrs-bronze/30 flex flex-wrap gap-1 border-b pb-2 text-sm ${className}`}>
      {tabs.map((t) => {
        const active = isActive(pathname, t);
        const className = `rounded px-3 py-1.5 transition-colors ${
          active
            ? "bg-osrs-bronze text-osrs-parchment"
            : "hover:bg-osrs-bronze/30 text-osrs-parchment-dark/80"
        } ${t.locked ? "opacity-60" : ""}`;
        const label = <TabLabel tab={t} />;
        return (
          <Link
            key={t.href}
            href={t.href as Route}
            aria-current={active ? "page" : undefined}
            className={className}
            title={t.locked ? "Requires a subscription upgrade" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export type NavCollapse = {
  /** Tab whose record routes (`…/events/42`) replace the whole row with a
   * breadcrumb. Sibling pages (`…/events/new`) keep the full row. */
  href: string;
  /** Crumb that links to the subtree root and drops down every tab, so nothing
   * becomes unreachable. Omit when the user has only the one tab — there is
   * nothing to drop down. */
  root?: { href: string; label: string };
};

/** Path segments below `parentHref` when the current route is one *record*
 * inside it, else null. The numeric check is what keeps sibling pages such as
 * `…/events/new` on the full tab row. */
function detailSegments(pathname: string, parentHref: string): string[] | null {
  if (!pathname.startsWith(`${parentHref}/`)) return null;
  const segments = pathname
    .slice(parentHref.length + 1)
    .split("/")
    .filter(Boolean);
  return segments[0] && /^\d+$/.test(segments[0]) ? segments : null;
}

const crumbSeparator = (
  <span aria-hidden className="text-osrs-parchment-dark/35">
    /
  </span>
);

/** "← Dashboard ⌄" — the subtree root plus a dropdown of every tab, so the
 * collapsed row costs at most one extra click. */
function RootCrumb({ tabs, root }: { tabs: NavTab[]; root: { href: string; label: string } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);
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
    <div ref={rootRef} className="relative flex items-center gap-0.5">
      <Link href={root.href as Route} className="hover:text-osrs-gold-bright">
        ← {root.label}
      </Link>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`All ${root.label} sections`}
        onClick={() => setOpen((o) => !o)}
        className="hover:text-osrs-gold-bright rounded p-0.5"
      >
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className={`size-2.5 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div role="menu" className="absolute left-0 top-full z-50 w-56 pt-2">
          <div className="card-pop menu-in max-h-[70vh] overflow-y-auto p-1.5">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href as Route}
                role="menuitem"
                title={t.locked ? "Requires a subscription upgrade" : undefined}
                className={`hover:bg-osrs-bronze/25 block rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                  isActive(pathname, t) ? "text-osrs-gold" : ""
                } ${t.locked ? "opacity-60" : ""}`}
              >
                <TabLabel tab={t} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** `discord` → `Discord`, `effort` → `Effort`. */
function segmentLabel(segment: string): string {
  const words = segment.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Breadcrumb shown instead of the tab row while a record page is open (t61):
 * a dozen equally-weighted sibling links sitting directly above the record's
 * own tab bar were being clicked by mistake, dumping admins out of the event
 * they were editing. */
function DetailCrumbs({
  tabs,
  collapse,
  segments,
  detailLabel,
  className = "",
}: {
  tabs: NavTab[];
  collapse: NavCollapse;
  segments: string[];
  detailLabel: string | null;
  className?: string;
}) {
  const parent = tabs.find((t) => t.href === collapse.href);
  const [id, ...sub] = segments;
  const detailHref = `${collapse.href}/${id}`;
  const trail = [
    ...(parent ? [{ label: parent.label, href: parent.href }] : []),
    // `#42` until the page names itself via `useDetailCrumb` (the layout
    // deliberately doesn't fetch the record just to title a crumb).
    { label: detailLabel ?? `#${id}`, href: detailHref },
    ...sub.map((segment, i) => ({
      label: segmentLabel(segment),
      href: `${detailHref}/${sub.slice(0, i + 1).join("/")}`,
    })),
  ];

  return (
    <nav
      aria-label="Breadcrumb"
      className={`text-osrs-parchment-dark/70 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm ${className}`}
    >
      {collapse.root && <RootCrumb tabs={tabs} root={collapse.root} />}
      {trail.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-x-1.5">
          {(i > 0 || collapse.root) && crumbSeparator}
          {i === trail.length - 1 ? (
            <span aria-current="page" className="text-osrs-parchment font-medium">
              {crumb.label}
            </span>
          ) : (
            <Link href={crumb.href as Route} className="hover:text-osrs-gold-bright">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

const SetDetailCrumb = createContext<((label: string | null) => void) | null>(null);

/**
 * Names the open record in the collapsed breadcrumb (`Events / Summer Bingo`)
 * from the page that already loaded it, keeping the extra fetch off the
 * layout's critical path. No-ops outside a `TabNavShell`, so the same
 * component can render in shells that have no tab row (e.g. `/admin/*`).
 */
export function useDetailCrumb(label: string | null | undefined) {
  const setLabel = useContext(SetDetailCrumb);
  useEffect(() => {
    if (!setLabel || !label) return;
    setLabel(label);
    return () => setLabel(null);
  }, [setLabel, label]);
}

/**
 * Tab row that collapses to a breadcrumb on the record routes of one tab.
 * Wraps the subtree's content so a page inside it can fill the record crumb
 * via `useDetailCrumb`.
 */
export function TabNavShell({
  tabs,
  collapse,
  className = "",
  children,
}: {
  tabs: NavTab[];
  collapse: NavCollapse;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [detailLabel, setDetailLabel] = useState<string | null>(null);
  const segments = detailSegments(pathname, collapse.href);

  return (
    <SetDetailCrumb.Provider value={setDetailLabel}>
      {segments ? (
        <DetailCrumbs
          tabs={tabs}
          collapse={collapse}
          segments={segments}
          detailLabel={detailLabel}
          className={className}
        />
      ) : (
        <TabNav tabs={tabs} className={className} />
      )}
      {children}
    </SetDetailCrumb.Provider>
  );
}

/** One top-level header item with an optional hover/click dropdown of
 * children. Query-string hrefs (e.g. `?tab=groups`) don't affect `pathname`,
 * so parent-active state comes from the path portion of the href. */
function HeaderNavItem({ tab }: { tab: NavTab }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);
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

  const active =
    isActive(pathname, tab) ||
    Boolean(
      tab.children?.some((c) => isActive(pathname, { ...c, href: c.href.split("?")[0] ?? c.href })),
    );
  const linkClass = active
    ? "text-osrs-gold-bright underline decoration-2 underline-offset-4"
    : "hover:text-osrs-gold-bright";

  if (!tab.children?.length) {
    return (
      <Link href={tab.href as Route} aria-current={active ? "page" : undefined} className={linkClass}>
        {tab.label}
      </Link>
    );
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link
        href={tab.href as Route}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-current={active ? "page" : undefined}
        className={`inline-flex items-center gap-1 ${linkClass}`}
      >
        {tab.label}
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className={`text-osrs-parchment-dark/60 size-2.5 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </Link>

      {/* pt-2 bridge keeps hover alive between the link and the card. */}
      {open && (
        <div role="menu" className="absolute left-1/2 top-full z-50 w-56 -translate-x-1/2 pt-2">
          <div className="card-pop menu-in p-1.5">
            {tab.children.map((c) => (
              <Link
                key={c.href}
                href={c.href as Route}
                className="hover:bg-osrs-bronze/25 block rounded-lg px-2.5 py-2 transition-colors"
              >
                <span className="hover:text-osrs-gold-bright block text-sm font-medium">{c.label}</span>
                {c.description && (
                  <span className="text-osrs-parchment-dark/60 block text-xs">{c.description}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Site header's top-level nav — text links, underline for the active one,
 * hoverable dropdowns for tabs with children. */
export function HeaderNav({ tabs }: { tabs: NavTab[] }) {
  return (
    <>
      {tabs.map((t) => (
        <HeaderNavItem key={t.href} tab={t} />
      ))}
    </>
  );
}
