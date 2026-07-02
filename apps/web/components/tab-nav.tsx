"use client";

/**
 * Shared active-aware tab/nav bar. Exact-match by default; pass
 * `matchPrefix: true` on tabs that own nested child routes (e.g. an "Events"
 * tab that should stay active on `/events/42`) — NOT on every tab, since a
 * root-ish tab like `/admin` is itself a path-prefix of every sibling tab and
 * would incorrectly light up alongside whichever sibling is actually active.
 */
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";

export type NavTab = { href: string; label: string; matchPrefix?: boolean };

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
        return (
          <Link
            key={t.href}
            href={t.href as Route}
            aria-current={active ? "page" : undefined}
            className={`rounded px-3 py-1.5 transition-colors ${
              active
                ? "bg-osrs-bronze text-osrs-parchment"
                : "hover:bg-osrs-bronze/30 text-osrs-parchment-dark/80"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Site header's top-level nav — text links, underline for the active one. */
export function HeaderNav({ tabs }: { tabs: NavTab[] }) {
  const pathname = usePathname();
  return (
    <>
      {tabs.map((t) => {
        const active = isActive(pathname, t);
        return (
          <Link
            key={t.href}
            href={t.href as Route}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "text-osrs-gold-bright underline decoration-2 underline-offset-4"
                : "hover:text-osrs-gold-bright"
            }
          >
            {t.label}
          </Link>
        );
      })}
    </>
  );
}
