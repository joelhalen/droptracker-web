import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import "./test-hero.css";

/**
 * Shell for the /test-hero homepage prototype.
 *
 * Lives inside the `(site)` route group so it inherits the real site chrome —
 * ticker, header, footer and the `max-w-6xl` gutter (components/site-chrome.tsx).
 * Full-bleed sections escape that gutter through the page-local `.th-bleed`
 * breakout in ./test-hero.css rather than by touching the layout.
 *
 * Guard: signed-in visitors only, so the prototype can be shared for feedback
 * without being public. `(site)` has no shared guard — each subtree gates
 * itself (CLAUDE.md rule 5) — so this layout owns it. `requireUser` redirects
 * straight into Discord OAuth and returns here.
 */
export const metadata: Metadata = {
  title: "Homepage prototype",
  // Prototype: must never be indexed or previewed while it lives at this path.
  robots: { index: false, follow: false, nocache: true },
};

export default async function TestHeroLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/test-hero");
  return <div className="th-page">{children}</div>;
}
