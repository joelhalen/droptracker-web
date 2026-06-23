import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/providers";
import { UserNav } from "@/components/user-nav";

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
          <header className="border-osrs-bronze/60 border-b">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <Link href="/" className="text-osrs-gold text-xl font-bold tracking-tight">
                Drop<span className="text-osrs-gold-bright">Tracker</span>
              </Link>
              <nav className="flex items-center gap-5 text-sm">
                <Link href="/leaderboards" className="hover:text-osrs-gold-bright">
                  Leaderboards
                </Link>
                <Link href="/search" className="hover:text-osrs-gold-bright">
                  Search
                </Link>
                <Link href="/announcements" className="hover:text-osrs-gold-bright">
                  News
                </Link>
                <UserNav />
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <footer className="border-osrs-bronze/40 text-osrs-parchment-dark/70 mt-16 border-t">
            <div className="mx-auto max-w-6xl px-4 py-6 text-xs">
              DropTracker — not affiliated with Jagex. Built on Next.js.
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
