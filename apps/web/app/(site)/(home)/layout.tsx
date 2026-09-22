import "./home.css";

/**
 * Shell for the homepage (`/`). `(home)` is a route group, so it adds nothing
 * to the URL: it only gives the page a folder to keep its islands, shaping and
 * stylesheet beside it.
 *
 * Lives inside the `(site)` route group so it inherits the real site chrome —
 * ticker, header, footer and the `max-w-6xl` gutter (components/site-chrome.tsx).
 * Full-bleed sections escape that gutter through the page-local `.hp-bleed`
 * breakout in ./home.css rather than by touching the layout.
 *
 * Public and indexable: no guard, and no metadata of its own, so the root
 * layout's default title and description apply. Until 2026-09 this page was
 * the signed-in-only candidate at /test-hero, which now redirects here
 * (next.config.ts).
 */
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <div className="hp-page">{children}</div>;
}
