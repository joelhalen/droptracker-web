/**
 * Apex landing for the clan-sites domain (osrs.site itself, no subdomain).
 * Reached via the apex-host rewrite in next.config.ts. A deliberately tiny
 * standalone page: what this domain is, plus pointers to the DropTracker
 * Discord and website.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "osrs.site — clan websites by DropTracker",
  description:
    "Custom websites for Old School RuneScape clans, powered by live DropTracker data.",
};

const SITES_DOMAIN = process.env.SITES_DOMAIN || "osrs.site";

export default function SitesLandingPage() {
  return (
    <div className="bg-osrs-surface-0 text-osrs-parchment flex min-h-screen items-center justify-center p-8">
      <div className="max-w-xl text-center">
        <h1 className="text-osrs-gold font-display text-5xl font-bold">{SITES_DOMAIN}</h1>
        <p className="text-osrs-parchment-dark/90 mt-4 text-lg">
          Custom websites for Old School RuneScape clans — live loot, leaderboards,
          records and more, powered by{" "}
          <a className="text-osrs-gold underline" href="https://www.droptracker.io/">
            DropTracker
          </a>
          .
        </p>
        <p className="text-osrs-parchment-dark/70 mt-2 text-sm">
          Every site here is built by its clan on their own subdomain, like{" "}
          <span className="text-osrs-gold-bright font-mono">your-clan.{SITES_DOMAIN}</span>.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://www.droptracker.io/premium"
            className="bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark rounded-lg px-5 py-2.5 font-medium transition-colors"
          >
            Get one for your clan
          </a>
          <a
            href="https://discord.gg/droptracker"
            className="border-osrs-bronze/60 hover:bg-osrs-bronze/30 rounded-lg border px-5 py-2.5 font-medium transition-colors"
          >
            Join our Discord
          </a>
          <a
            href="https://www.droptracker.io/"
            className="border-osrs-bronze/60 hover:bg-osrs-bronze/30 rounded-lg border px-5 py-2.5 font-medium transition-colors"
          >
            DropTracker.io
          </a>
        </div>
      </div>
    </div>
  );
}
