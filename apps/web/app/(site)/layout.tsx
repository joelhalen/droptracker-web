import type { Route } from "next";
import Link from "next/link";
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

/*
 * Site chrome (ticker + header + footer) lives in this (site) route group so
 * chromeless surfaces — the Discord Activity under /activity — can render from
 * the bare root layout without inheriting it.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
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
          </nav>
        </div>
      </footer>
    </>
  );
}
