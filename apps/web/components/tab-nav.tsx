"use client";

/**
 * Shared active-aware tab/nav bar. Exact-match by default; pass
 * `matchPrefix: true` on tabs that own nested child routes (e.g. an "Events"
 * tab that should stay active on `/events/42`) — NOT on every tab, since a
 * root-ish tab like `/admin` is itself a path-prefix of every sibling tab and
 * would incorrectly light up alongside whichever sibling is actually active.
 */
import { useEffect, useRef, useState } from "react";
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
        const label = (
          <>
            {t.label}
            {t.locked ? <span className="ml-1 opacity-70">🔒</span> : null}
            {t.badge && t.badge > 0 ? (
              <span className="bg-osrs-gold text-osrs-brown-dark ml-1.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold">
                {t.badge > 99 ? "99+" : t.badge}
              </span>
            ) : null}
          </>
        );
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
