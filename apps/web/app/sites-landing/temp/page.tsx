/**
 * Services landing for the clan-sites domain, served at `osrs.site/temp`
 * (apex-host rewrite in next.config.ts).
 *
 * Advertises our Discord bot + clan website development work, using
 * DropTracker as the portfolio piece rather than as the subject. Written as a
 * standalone full page so promoting it to the apex root later is a one-line
 * rewrite change — no content rework.
 *
 * Chromeless by design: it sits outside the (site) route group, so it carries
 * the OSRS palette without the DropTracker app header/footer.
 */
import type { Metadata } from "next";

const SITES_DOMAIN = process.env.SITES_DOMAIN || "osrs.site";
const DISCORD = "https://discord.gg/droptracker";
const DROPTRACKER = "https://www.droptracker.io/";

export const metadata: Metadata = {
  title: "OSRS clan tools, built to order — Discord bots & clan websites",
  description:
    "We build custom Discord bots and Old School RuneScape clan websites. From the team behind DropTracker, tracking 186M+ drops for 260+ clans.",
  robots: { index: false, follow: false },
};

/** Headline figures from the live DropTracker platform. Static on purpose —
 *  this page is public marketing, not a dashboard. */
const STATS: Array<{ value: string; label: string }> = [
  { value: "186M+", label: "Drops tracked" },
  { value: "19,000+", label: "Players" },
  { value: "260+", label: "Clans served" },
  { value: "263", label: "Discord servers" },
];

const SERVICES: Array<{ icon: string; title: string; blurb: string; points: string[] }> = [
  {
    icon: "🤖",
    title: "Custom Discord bots",
    blurb:
      "Bots built for how your clan actually runs — not another off-the-shelf template.",
    points: [
      "Slash commands, buttons and modals",
      "Event automation: bingo, raids, competitions",
      "Roles, moderation and onboarding flows",
      "Game-data integrations (WOM, RuneLite, wiki)",
      "Hosted and maintained, or handed over",
    ],
  },
  {
    icon: "🌐",
    title: "Custom clan websites",
    blurb:
      "A real site for your clan, wired to live Old School RuneScape data.",
    points: [
      "Your own domain or a free " + SITES_DOMAIN + " subdomain",
      "Live loot boards, leaderboards and PB records",
      "Member rosters and recruitment pages",
      "Built in a drag-and-drop editor you keep control of",
      "Fully custom design work on request",
    ],
  },
];

/** DropTracker as proof of work — what we have actually shipped and run. */
const BUILT: Array<{ label: string; detail: string }> = [
  { label: "RuneLite plugin", detail: "On the official plugin hub, in daily use." },
  { label: "Discord bots", detail: "Live in 260+ servers, 24/7." },
  { label: "Web platform", detail: "Profiles, leaderboards, admin tooling." },
  { label: "Discord Activity", detail: "An embedded in-Discord app." },
  { label: "Events engine", detail: "Bingo boards, team scoring, prize pots." },
  { label: "Data pipeline", detail: "186M+ submissions processed." },
];

export default function ServicesLandingPage() {
  return (
    <div className="bg-osrs-surface-0 text-osrs-parchment min-h-screen">
      <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:py-24">
        {/* Hero */}
        <header className="text-center">
          <span className="text-osrs-gold text-xs font-bold tracking-[0.2em] uppercase">
            From the team behind DropTracker
          </span>
          <h1 className="text-osrs-gold font-display mt-3 text-4xl leading-tight font-bold sm:text-6xl">
            We build tools for
            <br />
            Old School RuneScape clans
          </h1>
          <p className="text-osrs-parchment-dark/90 mx-auto mt-5 max-w-2xl text-lg">
            Custom Discord bots and clan websites, built by people who have run OSRS
            infrastructure at scale for years — not a side project.
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
        <section className="mt-16 grid gap-6 md:grid-cols-2">
          {SERVICES.map((svc) => (
            <div
              key={svc.title}
              className="border-osrs-bronze/40 bg-osrs-surface-1 shadow-osrs-card rounded-2xl border p-7"
            >
              <div className="text-3xl">{svc.icon}</div>
              <h2 className="text-osrs-gold font-display mt-3 text-2xl font-bold">
                {svc.title}
              </h2>
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
        </section>

        {/* Proof of work */}
        <section className="mt-16">
          <h2 className="text-osrs-gold font-display text-center text-2xl font-bold">
            What we&apos;ve already shipped
          </h2>
          <p className="text-osrs-parchment-dark/75 mx-auto mt-2 max-w-2xl text-center text-sm">
            DropTracker is our own platform. Everything we would build for you, we run
            ourselves — in production, for real clans, every day.
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
            Tell us what your clan needs
          </h2>
          <p className="text-osrs-parchment-dark/85 mx-auto mt-3 max-w-xl">
            Bot, website, or both. Message us on Discord with the idea and we&apos;ll tell
            you honestly whether we&apos;re the right people to build it.
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
          <span>Not affiliated with Jagex Ltd.</span>
        </footer>
      </div>
    </div>
  );
}
