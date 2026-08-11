/**
 * Services landing for the sites domain, served at `osrs.site/temp`
 * (apex-host rewrite in next.config.ts).
 *
 * Positioning: general-purpose Discord bot and custom app development, with
 * the OSRS/DropTracker work as the proof rather than the boundary — someone
 * wanting a moderation bot for a non-gaming server should recognise
 * themselves here too.
 *
 * SEO: full metadata + JSON-LD is in place so promoting this to the apex root
 * is a one-line rewrite change with no marketing rework. It is still
 * `noindex` while it lives at /temp — building ranking signal on a URL that
 * is about to move would split it. Drop the `robots` block when this becomes
 * the real landing page.
 *
 * Chromeless by design: outside the (site) route group, so it carries the
 * OSRS palette without the DropTracker app header/footer.
 */
import type { Metadata } from "next";

const SITES_DOMAIN = process.env.SITES_DOMAIN || "osrs.site";
const PAGE_URL = `https://${SITES_DOMAIN}/temp`;
const DISCORD = "https://discord.gg/droptracker";
const DROPTRACKER = "https://www.droptracker.io/";

const TITLE = "Discord Bot Development & Custom App Builds | DropTracker Studio";
const DESCRIPTION =
  "Custom Discord bot development, community management tools and bespoke web apps. Built by the team behind DropTracker — 186M+ events processed across 260+ Discord servers.";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${SITES_DOMAIN}`),
  // `absolute` bypasses the root layout's "%s · DropTracker" template: this is
  // a standalone marketing page on its own domain, and the appended branding
  // both duplicated "DropTracker" and pushed the title past the ~60 chars
  // search results actually show.
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: [
    "discord bot development",
    "custom discord bot",
    "hire discord bot developer",
    "discord bot developer for hire",
    "community management tools",
    "clan management software",
    "custom web app development",
    "discord activity development",
    "discord server automation",
    "gaming community tools",
    "osrs clan website",
    "old school runescape discord bot",
    "runelite plugin development",
  ],
  applicationName: "DropTracker Studio",
  authors: [{ name: "DropTracker", url: DROPTRACKER }],
  creator: "DropTracker",
  publisher: "DropTracker",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "website",
    url: PAGE_URL,
    siteName: "DropTracker Studio",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-default.png"],
  },
  category: "technology",
  // Still a temporary URL — see the file header before removing this.
  robots: { index: false, follow: false },
};

/** Search engines read services and credibility far better from JSON-LD than
 *  from prose; this mirrors what the page says, nothing extra. */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "DropTracker Studio",
  url: PAGE_URL,
  description: DESCRIPTION,
  areaServed: "Worldwide",
  knowsAbout: [
    "Discord bot development",
    "Discord Activities",
    "Community management tooling",
    "Custom web application development",
    "Game data integrations",
    "Old School RuneScape tooling",
  ],
  sameAs: [DROPTRACKER, DISCORD],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Development services",
    itemListElement: [
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Custom Discord bot development" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Community & clan management tools" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Custom web apps and dashboards" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Game and platform integrations" } },
    ],
  },
};

const STATS: Array<{ value: string; label: string }> = [
  { value: "186M+", label: "Events processed" },
  { value: "260+", label: "Discord servers" },
  { value: "19,000+", label: "Tracked users" },
  { value: "24/7", label: "Production uptime" },
];

const SERVICES: Array<{ icon: string; title: string; blurb: string; points: string[] }> = [
  {
    icon: "🤖",
    title: "Discord bots",
    blurb: "For any community — gaming, creator, business or hobby.",
    points: [
      "Slash commands, buttons, modals and menus",
      "Moderation, onboarding and role automation",
      "Ticketing, applications and approval flows",
      "Scheduled jobs, alerts and notifications",
      "Hosted and maintained, or handed over to you",
    ],
  },
  {
    icon: "📊",
    title: "Custom apps & dashboards",
    blurb: "When a bot isn't enough and off-the-shelf doesn't fit.",
    points: [
      "Web dashboards and admin panels",
      "Discord Activities (embedded in-client apps)",
      "APIs, data pipelines and reporting",
      "Payments, subscriptions and access control",
      "Authentication via Discord, OAuth or your own",
    ],
  },
  {
    icon: "🎮",
    title: "Game & community tooling",
    blurb: "Our specialty — and where most of our production experience lives.",
    points: [
      "Old School RuneScape: RuneLite plugins, clan tracking",
      "Leaderboards, competitions, bingo and events",
      "Third-party game APIs and stat integrations",
      "Member rosters, ranks and progression systems",
      "Anti-cheat checks and submission verification",
    ],
  },
  {
    icon: "🌐",
    title: "Websites",
    blurb: "A real site for your community, wired to live data.",
    points: [
      "Custom design, or a self-serve builder we host",
      "Live stats pulled straight from your bot or game",
      "Recruitment, roster and announcement pages",
      "Your own domain, or a free " + SITES_DOMAIN + " subdomain",
      "Fast, responsive, and yours to keep",
    ],
  },
];

const BUILT: Array<{ label: string; detail: string }> = [
  { label: "Discord bots at scale", detail: "Live in 260+ servers, around the clock." },
  { label: "RuneLite plugin", detail: "Published on the official plugin hub." },
  { label: "Full web platform", detail: "Profiles, leaderboards, billing, admin tooling." },
  { label: "Discord Activity", detail: "An embedded in-client app, not just a bot." },
  { label: "Events engine", detail: "Bingo boards, team scoring, prize pots." },
  { label: "Data pipeline", detail: "186M+ submissions processed and queryable." },
];

export default function ServicesLandingPage() {
  return (
    <div className="bg-osrs-surface-0 text-osrs-parchment min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:py-24">
        {/* Hero */}
        <header className="text-center">
          <span className="text-osrs-gold text-xs font-bold tracking-[0.2em] uppercase">
            From the team behind DropTracker
          </span>
          <h1 className="text-osrs-gold font-display mt-3 text-4xl leading-tight font-bold sm:text-6xl">
            Discord bots &amp; custom apps,
            <br />
            built to order
          </h1>
          <p className="text-osrs-parchment-dark/90 mx-auto mt-5 max-w-2xl text-lg">
            We build bots, dashboards and web apps for communities that have outgrown
            off-the-shelf tools — with deep roots in gaming and Old School RuneScape.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={DISCORD}
              className="bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark rounded-lg px-6 py-3 font-semibold transition-colors"
            >
              Start a project
            </a>
            <a
              href={DROPTRACKER}
              className="border-osrs-bronze/60 hover:bg-osrs-bronze/30 rounded-lg border px-6 py-3 font-semibold transition-colors"
            >
              See our work →
            </a>
          </div>
        </header>

        {/* Credibility strip */}
        <section
          aria-label="Platform scale"
          className="border-osrs-bronze/40 bg-osrs-surface-2 mt-16 grid grid-cols-2 overflow-hidden rounded-2xl border sm:grid-cols-4"
        >
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={`px-4 py-6 text-center ${
                i < STATS.length - 1 ? "border-osrs-bronze/30 sm:border-r" : ""
              } ${i < 2 ? "border-osrs-bronze/30 border-b sm:border-b-0" : ""}`}
            >
              <div className="text-osrs-gold font-display text-2xl font-bold sm:text-3xl">
                {s.value}
              </div>
              <div className="text-osrs-parchment-dark/70 mt-1 text-xs">{s.label}</div>
            </div>
          ))}
        </section>

        {/* Services */}
        <section className="mt-16">
          <h2 className="text-osrs-gold font-display text-center text-2xl font-bold sm:text-3xl">
            What we build
          </h2>
          <div className="mt-7 grid gap-6 md:grid-cols-2">
            {SERVICES.map((svc) => (
              <div
                key={svc.title}
                className="border-osrs-bronze/40 bg-osrs-surface-1 shadow-osrs-card rounded-2xl border p-7"
              >
                <div className="text-3xl">{svc.icon}</div>
                <h3 className="text-osrs-gold font-display mt-3 text-2xl font-bold">
                  {svc.title}
                </h3>
                <p className="text-osrs-parchment-dark/85 mt-2">{svc.blurb}</p>
                <ul className="mt-4 space-y-1.5">
                  {svc.points.map((p) => (
                    <li key={p} className="text-osrs-parchment-dark/80 flex gap-2 text-sm">
                      <span className="text-osrs-gold-bright shrink-0">▸</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Proof of work */}
        <section className="mt-16">
          <h2 className="text-osrs-gold font-display text-center text-2xl font-bold">
            What we&apos;ve already shipped
          </h2>
          <p className="text-osrs-parchment-dark/75 mx-auto mt-2 max-w-2xl text-center text-sm">
            DropTracker is our own platform — a bot network, a plugin, a web app and a data
            pipeline running together in production. Everything we&apos;d build for you, we
            already run ourselves.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BUILT.map((b) => (
              <div
                key={b.label}
                className="border-osrs-bronze/25 bg-osrs-surface-1/60 rounded-xl border px-4 py-3"
              >
                <div className="text-osrs-gold-bright text-sm font-semibold">{b.label}</div>
                <div className="text-osrs-parchment-dark/70 mt-0.5 text-xs">{b.detail}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-osrs-bronze/40 bg-osrs-surface-1 shadow-osrs-card mt-16 rounded-2xl border p-8 text-center sm:p-10">
          <h2 className="text-osrs-gold font-display text-2xl font-bold sm:text-3xl">
            Tell us what you need built
          </h2>
          <p className="text-osrs-parchment-dark/85 mx-auto mt-3 max-w-xl">
            Bot, app, website, or something we haven&apos;t listed. Message us on Discord
            with the idea and we&apos;ll tell you honestly whether we&apos;re the right
            people to build it.
          </p>
          <a
            href={DISCORD}
            className="bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark mt-6 inline-block rounded-lg px-7 py-3 font-semibold transition-colors"
          >
            Get in touch on Discord
          </a>
        </section>

        {/* Footer */}
        <footer className="border-osrs-bronze/25 text-osrs-parchment-dark/60 mt-14 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t pt-7 text-xs">
          <a className="hover:text-osrs-gold" href={DROPTRACKER}>
            DropTracker.io
          </a>
          <a className="hover:text-osrs-gold" href={`https://${SITES_DOMAIN}/`}>
            {SITES_DOMAIN}
          </a>
          <a className="hover:text-osrs-gold" href={DISCORD}>
            Discord
          </a>
          <span>Not affiliated with Jagex Ltd. or Discord Inc.</span>
        </footer>
      </div>
    </div>
  );
}
