"use client";

/**
 * Sectioned navigation for the superadmin area. Desktop (lg+) renders a
 * sticky sidebar; smaller screens get a disclosure button showing the current
 * page that expands into the same sectioned list.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { ADMIN_SECTIONS, ADMIN_PAGES, type AdminNavItem } from "@/lib/admin-nav";

const OVERVIEW: AdminNavItem = { href: "/admin", label: "Overview", desc: "" };

function isActive(pathname: string, item: AdminNavItem): boolean {
  if (pathname === item.href) return true;
  return Boolean(item.matchPrefix) && pathname.startsWith(`${item.href}/`);
}

function NavLink({ item, pathname }: { item: AdminNavItem; pathname: string }) {
  const active = isActive(pathname, item);
  return (
    <Link
      href={item.href as Route}
      aria-current={active ? "page" : undefined}
      className={`block rounded-lg px-3 py-1.5 transition-colors ${
        active
          ? "bg-osrs-bronze text-osrs-parchment"
          : "text-osrs-parchment-dark/80 hover:bg-osrs-surface-2"
      }`}
    >
      {item.label}
    </Link>
  );
}

function NavList({ pathname }: { pathname: string }) {
  return (
    <nav className="space-y-4 text-sm">
      <NavLink item={OVERVIEW} pathname={pathname} />
      {ADMIN_SECTIONS.map((section) => (
        <div key={section.label}>
          <div className="text-osrs-parchment-dark/50 mb-1 px-3 text-[11px] font-semibold tracking-wider uppercase">
            {section.label}
          </div>
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile panel after navigating.
  useEffect(() => setOpen(false), [pathname]);

  const current =
    pathname === OVERVIEW.href ? OVERVIEW : ADMIN_PAGES.find((p) => isActive(pathname, p));

  return (
    <>
      {/* Mobile: current-page disclosure. */}
      <div className="lg:hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="border-osrs-bronze/40 bg-osrs-surface-2/50 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm"
        >
          <span className="font-medium">{current?.label ?? "Admin pages"}</span>
          <svg
            viewBox="0 0 12 12"
            aria-hidden
            className={`text-osrs-parchment-dark/60 size-3 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path
              d="M2 4l4 4 4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {open && (
          <div className="border-osrs-bronze/30 bg-osrs-surface-1/80 mt-2 rounded-lg border p-2">
            <NavList pathname={pathname} />
          </div>
        )}
      </div>

      {/* Desktop: sticky sectioned sidebar. */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
          <NavList pathname={pathname} />
        </div>
      </aside>
    </>
  );
}
