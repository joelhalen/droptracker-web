"use client";

/**
 * Site header (UI refresh). Replaces the old inline layout header + UserNav:
 *
 *  - Desktop: brand, top-level nav, theme menu, and a real user menu — the
 *    signed-in user's avatar/name opens a dropdown (hover or click) with
 *    Dashboard, Settings, their group admin panels, Admin CP (superadmins),
 *    and Sign out. The old design rendered the username as an unlabeled link.
 *  - Mobile: nav collapses behind a hamburger into a slide-down panel with
 *    the same links; previously the nav row just overflowed on small screens.
 *
 * Auth state comes from `/api/me` on mount (same island pattern as the old
 * UserNav) so the server-rendered shell stays static/cacheable.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { FaDiscord } from "react-icons/fa6";
import type { Me } from "@droptracker/api-types";
import { useMe } from "@/lib/use-me";
import { HeaderNav, type NavTab } from "@/components/tab-nav";
import { ThemeMenu } from "@/components/theme";
import { ModeratorBadge, NameTile, SuperadminBadge } from "@/components/ui";

/** Groups the user can administrate — shown in the account menus. */
function adminGroups(me: Me) {
  return me.groups.filter((g) => g.role === "owner" || g.role === "admin");
}

function Avatar({ me, size = "size-7" }: { me: Me; size?: string }) {
  const name = me.display_name ?? "?";
  if (me.avatar_url) {
    // Discord CDN avatar; plain <img> matches existing usage in the admin panels.
    return <img src={me.avatar_url} alt="" className={`${size} rounded-full object-cover`} />;
  }
  return <NameTile name={name} size="sm" className="rounded-full" />;
}

const MENU_ITEM_CLASS =
  "hover:bg-osrs-bronze/25 hover:text-osrs-gold-bright flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors";

/** Sign-out is a POST form, never a Link: a prefetchable GET logout gets
 *  fired by Next.js prefetch and silently clears the session. */
function SignOutItem() {
  return (
    <form action="/api/auth/logout" method="post">
      <button type="submit" className={`${MENU_ITEM_CLASS} text-osrs-parchment-dark/80 cursor-pointer`}>
        <span aria-hidden>⎋</span> Sign out
      </button>
    </form>
  );
}

/** Shared dropdown/mobile-panel body for a signed-in user. */
function AccountLinks({ me, onNavigate }: { me: Me; onNavigate?: () => void }) {
  const groups = adminGroups(me);
  return (
    <>
      <Link href="/dashboard" className={MENU_ITEM_CLASS} onClick={onNavigate}>
        <span aria-hidden>👤</span> My dashboard
      </Link>
      <Link href="/settings" className={MENU_ITEM_CLASS} onClick={onNavigate}>
        <span aria-hidden>⚙</span> Settings
      </Link>

      {groups.length > 0 && (
        <>
          <div className="border-osrs-bronze/25 mx-2 my-1.5 border-t" />
          <div className="text-osrs-parchment-dark/60 px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider">
            Group admin
          </div>
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/groups/${g.id}/admin` as Route}
              className={MENU_ITEM_CLASS}
              onClick={onNavigate}
            >
              <NameTile name={g.name} size="sm" />
              <span className="truncate">{g.name}</span>
            </Link>
          ))}
        </>
      )}

      {(me.is_superadmin || me.is_moderator) && (
        <>
          <div className="border-osrs-bronze/25 mx-2 my-1.5 border-t" />
          {me.is_superadmin && (
            <Link href="/admin" className={`${MENU_ITEM_CLASS} text-osrs-red`} onClick={onNavigate}>
              <span aria-hidden>⚔</span> Admin CP
            </Link>
          )}
          <Link
            href={"/moderation" as Route}
            className={`${MENU_ITEM_CLASS} text-sky-300`}
            onClick={onNavigate}
          >
            <span aria-hidden>🛡</span> Moderation
          </Link>
        </>
      )}

      <div className="border-osrs-bronze/25 mx-2 my-1.5 border-t" />
      <SignOutItem />
    </>
  );
}

function SignInLink({ className = "" }: { className?: string }) {
  // `prefetch={false}`: /api/auth/login is a mutating GET (it issues the OAuth
  // state cookie), so it must not be fired by Link prefetch.
  return (
    <Link
      href="/api/auth/login"
      prefetch={false}
      className={`bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${className}`}
    >
      <FaDiscord className="size-4 shrink-0" aria-hidden />
      Sign in with Discord
    </Link>
  );
}

/** Desktop user dropdown: avatar + name button, hover/click to open. */
function UserMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close when navigating or clicking/escaping away.
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
        onClick={() => setOpen((o) => !o)}
        className="hover:bg-osrs-bronze/25 flex cursor-pointer items-center gap-2 rounded-lg py-1 pl-1.5 pr-2 transition-colors"
      >
        <Avatar me={me} />
        <span className="max-w-32 truncate text-sm font-medium">
          {me.display_name ?? "My account"}
        </span>
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className={`text-osrs-parchment-dark/60 size-3 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        // max-h + overflow: users administrating many groups get a long menu;
        // it scrolls internally instead of running off the bottom of the screen.
        <div
          role="menu"
          className="card-pop menu-in absolute right-0 top-full z-50 max-h-[min(75vh,34rem)] w-64 overflow-y-auto overscroll-contain p-1.5"
        >
          <div className="flex items-center gap-2.5 px-2.5 pb-2 pt-1.5">
            <Avatar me={me} size="size-9" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{me.display_name ?? "My account"}</div>
              <div className="text-osrs-parchment-dark/60 text-xs">
                {me.is_superadmin ? (
                  <SuperadminBadge />
                ) : me.is_moderator ? (
                  <ModeratorBadge />
                ) : (
                  "Signed in via Discord"
                )}
              </div>
            </div>
          </div>
          <div className="border-osrs-bronze/25 mx-2 mb-1.5 border-t" />
          <AccountLinks me={me} />
        </div>
      )}
    </div>
  );
}

export function SiteHeader({ tabs }: { tabs: NavTab[] }) {
  const me = useMe();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile panel after navigating.
  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <header className="bg-osrs-surface-2/95 border-osrs-bronze/30 relative border-b shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="text-osrs-gold font-display flex items-center gap-2 text-xl font-bold tracking-tight"
        >
          {/* Animated brand mark (56px source, rendered 28px — /public/logo.gif is a
              downscaled cut of /img/droptracker-small.gif). Plain <img>: next/image
              would re-encode away the animation. */}
          <img src="/logo.gif" alt="" width={28} height={28} className="rounded" />
          Drop<span className="text-osrs-gold-bright">Tracker</span>
        </Link>

        {/* Desktop nav. `lg` breakpoint, not `md`: the full row (brand + 7 tabs
            + theme + sign-in) needs ~980px, so between md and lg it overflowed —
            the nav overlapped the brand and the sign-in text wrapped. */}
        <nav className="hidden items-center gap-6 text-sm lg:flex">
          <HeaderNav tabs={tabs} />
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <ThemeMenu />
          {me === undefined ? (
            <span className="bg-osrs-bronze/20 h-8 w-24 animate-pulse rounded-lg" aria-hidden />
          ) : me ? (
            <UserMenu me={me} />
          ) : (
            <SignInLink />
          )}
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-1 lg:hidden">
          <ThemeMenu />
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((o) => !o)}
            className="hover:bg-osrs-bronze/30 flex size-9 cursor-pointer items-center justify-center rounded-lg transition-colors"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              {mobileOpen ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile slide-down panel. Capped to the space under the header and
          internally scrollable: with enough nav tabs + admin groups the panel
          outgrows small screens, and without its own scroll container the
          page scrolled behind it instead — the bottom items (Admin CP, Sign
          out) were unreachable. `overscroll-contain` stops the scroll from
          chaining to the page when the panel hits its ends. */}
      {mobileOpen && (
        <div
          id="mobile-menu"
          className="card-pop menu-in absolute inset-x-3 top-full z-50 mt-1 max-h-[calc(100dvh-7rem)] touch-pan-y overflow-y-auto overscroll-contain p-2 lg:hidden"
        >
          <nav className="space-y-0.5">
            {tabs.map((t) => {
              const active = pathname === t.href || (t.matchPrefix && pathname.startsWith(`${t.href}/`));
              return (
                <div key={t.href}>
                  <Link
                    href={t.href as Route}
                    aria-current={active ? "page" : undefined}
                    className={`${MENU_ITEM_CLASS} ${active ? "bg-osrs-bronze/25 text-osrs-gold-bright" : ""}`}
                  >
                    {t.label}
                  </Link>
                  {t.children?.map((c) => (
                    <Link
                      key={c.href}
                      href={c.href as Route}
                      className={`${MENU_ITEM_CLASS} text-osrs-parchment-dark/80 pl-7 text-[13px]`}
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              );
            })}
          </nav>

          <div className="border-osrs-bronze/25 mx-2 my-1.5 border-t" />

          {me === undefined ? null : me ? (
            <>
              <div className="flex items-center gap-2.5 px-2.5 py-2">
                <Avatar me={me} size="size-8" />
                <span className="truncate text-sm font-semibold">
                  {me.display_name ?? "My account"}
                </span>
                {me.is_superadmin && <SuperadminBadge />}
                {!me.is_superadmin && me.is_moderator && <ModeratorBadge />}
              </div>
              <AccountLinks me={me} onNavigate={() => setMobileOpen(false)} />
            </>
          ) : (
            <div className="px-2.5 py-2">
              <SignInLink className="w-full" />
            </div>
          )}
        </div>
      )}
    </header>
  );
}
