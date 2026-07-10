import type { Metadata } from "next";
import Link from "next/link";
import { env } from "@/lib/env";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";
import { LiveDropTicker } from "@/components/live-drop-ticker";
import { SiteHeader } from "@/components/site-header";
import { THEME_INIT_SCRIPT } from "@/components/theme";
import type { NavTab } from "@/components/tab-nav";

/*
 * Committed variable fonts (UI refresh): Figtree for body/UI text, Cinzel as
 * the RuneScape-flavored display face for the brand and headings. Local files
 * (app/fonts/) so builds never depend on a fonts CDN; globals.css maps them
 * into the `--font-sans` / `--font-display` theme tokens.
 */
const figtree = localFont({
  src: "./fonts/figtree-latin.woff2",
  weight: "300 900",
  display: "swap",
  variable: "--font-figtree",
});

const cinzel = localFont({
  src: "./fonts/cinzel-latin.woff2",
  weight: "400 900",
  display: "swap",
  variable: "--font-cinzel",
});

// The actual OSRS UI face, used only by the native lootboard so it matches the
// PIL-generated board 1:1 (disc/lootboard/generator.py renders with this ttf).
const runescape = localFont({
  src: "./fonts/runescape_uf.ttf",
  display: "swap",
  variable: "--font-runescape",
});

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

// metadataBase lets every page use relative OG/twitter image paths; dynamic
// pages (groups, players, events) override `images` in their generateMetadata.
export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: "DropTracker — OSRS Loot Tracking & Leaderboards",
    template: "%s · DropTracker",
  },
  description:
    "Live Old School RuneScape loot leaderboards, player and clan profiles, and drop feeds.",
  applicationName: "DropTracker",
  keywords: [
    "OSRS",
    "Old School RuneScape",
    "loot tracker",
    "drop tracker",
    "clan leaderboards",
    "RuneLite plugin",
  ],
  openGraph: {
    siteName: "DropTracker",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "DropTracker — Old School RuneScape loot tracking",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the theme init script may set data-theme on
    // <html> before React hydrates — that attribute diff is expected.
    <html
      lang="en"
      className={`${figtree.variable} ${cinzel.variable} ${runescape.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
        {/* Apply the stored theme before first paint (components/theme.tsx). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Providers>
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
        </Providers>
      </body>
    </html>
  );
}
