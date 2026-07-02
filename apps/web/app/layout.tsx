import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/providers";
import { UserNav } from "@/components/user-nav";
import { LiveDropTicker } from "@/components/live-drop-ticker";
import { HeaderNav, type NavTab } from "@/components/tab-nav";

// "Events" owns a nested /events/[id] detail route — stay highlighted there too.
const HEADER_TABS: NavTab[] = [
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/events", label: "Events", matchPrefix: true },
  { href: "/search", label: "Search" },
  { href: "/announcements", label: "News", matchPrefix: true },
];

export const metadata: Metadata = {
  title: {
    default: "DropTracker",
    template: "%s · DropTracker",
  },
  description:
    "Live Old School RuneScape loot leaderboards, player and clan profiles, and drop feeds.",
  openGraph: {
    siteName: "DropTracker",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>
          {/* Ticker + header stick together as one unit — avoids a fragile
              hardcoded pixel offset between two separately-sticky elements. */}
          <div className="sticky top-0 z-40">
            <LiveDropTicker />
            <header className="bg-osrs-surface-2/95 border-osrs-bronze/30 border-b shadow-lg backdrop-blur">
              <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
                <Link href="/" className="text-osrs-gold text-xl font-bold tracking-tight">
                  Drop<span className="text-osrs-gold-bright">Tracker</span>
                </Link>
                <nav className="flex items-center gap-6 text-sm">
                  <HeaderNav tabs={HEADER_TABS} />
                  <UserNav />
                </nav>
              </div>
            </header>
          </div>
          <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
          <footer className="border-osrs-bronze/30 bg-osrs-surface-1/60 text-osrs-parchment-dark/70 mt-20 border-t">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs">
              <span>DropTracker — not affiliated with Jagex. Built on Next.js.</span>
              <nav className="flex gap-4">
                <Link href="/docs" className="hover:text-osrs-gold-bright">
                  Docs
                </Link>
                <Link href="/premium" className="hover:text-osrs-gold-bright">
                  Premium
                </Link>
                <Link href="/announcements" className="hover:text-osrs-gold-bright">
                  News
                </Link>
              </nav>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
