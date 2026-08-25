import type { Route } from "next";
import Link from "next/link";
import { ChatWidget } from "@/components/chat-widget/chat-widget";
import { LiveDropTicker } from "@/components/live-drop-ticker";
import { SiteHeader } from "@/components/site-header";
import type { NavTab } from "@/components/tab-nav";

// "Events" owns a nested /events/[id] detail route — stay highlighted there too.
const HEADER_TABS: NavTab[] = [
  {
    href: "/leaderboards",
    label: "Leaderboards",
    children: [
      {
        href: "/leaderboards?tab=players",
        label: "Players",
        description: "Top individual looters by period",
      },
      {
        href: "/leaderboards?tab=groups",
        label: "Groups",
        description: "Clans ranked by monthly loot",
      },
      {
        href: "/personal-bests",
        label: "Personal bests",
        description: "Fastest kill times per boss and team size",
      },
    ],
  },
  { href: "/events", label: "Events", matchPrefix: true },
  { href: "/announcements", label: "News", matchPrefix: true },
  { href: "/docs", label: "Docs", matchPrefix: true },
  { href: "/suggestions", label: "Suggestions" },
  {
    href: "/premium",
    label: "Premium",
    children: [
      {
        href: "/premium",
        label: "Group upgrades",
        description: "Unlock features for your whole clan",
      },
      {
        href: "/premium#supporter",
        label: "Become a supporter",
        description: "Personal perks + submission DMs",
      },
    ],
  },
  { href: "/search", label: "Search" },
];

/**
 * Ticker + header + page gutter + footer — the site's visual frame.
 *
 * Lives here rather than inline in `app/(site)/layout.tsx` because the root
 * interrupt boundaries need it too. A fully-unmatched URL matches no segment,
 * so Next renders `app/not-found.tsx` against the ROOT layout only — the
 * `(site)` layout never runs, and the 404 used to arrive with no header or
 * footer. Same for interrupts thrown from `(site)/layout.tsx` itself, which
 * bubble past the `(site)` boundaries to the root copies. Those files wrap
 * themselves in this component to get the chrome back; every page under
 * `(site)` gets it from the layout, so nothing renders it twice.
 *
 * Chromeless surfaces (`app/activity`, `app/board-image`) still sit outside
 * `(site)` and never render this. The one leak is a fully-unmatched path on the
 * activity host, which lands on the root 404 and therefore shows site chrome —
 * a nested `not-found.tsx` cannot catch unmatched URLs, only `notFound()` calls
 * from inside its own segment, so there is no way to opt that case out.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Ticker + header stick together as one unit — avoids a fragile
          hardcoded pixel offset between two separately-sticky elements. */}
      <div className="sticky top-0 z-40">
        <LiveDropTicker />
        <SiteHeader tabs={HEADER_TABS} />
      </div>
      <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
      <footer className="border-osrs-bronze/30 bg-osrs-surface-1/60 text-osrs-parchment-dark/70 mt-20 border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs">
          <span>DropTracker — not affiliated with Jagex. Built on Next.js.</span>
          <nav className="flex gap-4">
            <Link href="/docs" className="hover:text-osrs-gold-bright">
              Docs
            </Link>
            <Link href={"/item-values" as Route} className="hover:text-osrs-gold-bright">
              Item values
            </Link>
            <Link href="/premium" className="hover:text-osrs-gold-bright">
              Premium
            </Link>
            <Link href="/announcements" className="hover:text-osrs-gold-bright">
              News
            </Link>
            <Link href="/suggestions" className="hover:text-osrs-gold-bright">
              Suggestions
            </Link>
            <Link href={"/privacy" as Route} className="hover:text-osrs-gold-bright">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
      {/* Support widget (web102a): a client island that renders nothing while
          signed out. Chromeless surfaces never render SiteChrome, so the
          widget is automatically absent from /activity and /board-image. */}
      <ChatWidget />
    </>
  );
}
