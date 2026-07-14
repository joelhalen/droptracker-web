import type { Metadata } from "next";
import { env } from "@/lib/env";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";
import { THEME_INIT_SCRIPT } from "@/components/theme";

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

/*
 * Bare shell only — html/body, fonts, theme, providers. Site chrome (header,
 * ticker, footer, page gutter) lives in app/(site)/layout.tsx so chromeless
 * surfaces like the Discord Activity (/activity) don't inherit it.
 */
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
