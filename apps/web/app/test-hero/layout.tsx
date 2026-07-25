import type { Metadata } from "next";
import { requireSuperadmin } from "@/lib/auth";
import "./test-hero.css";

/**
 * Admin-only shell for the /test-hero landing-page prototype.
 *
 * This route deliberately sits OUTSIDE the `(site)` route group: a full-bleed
 * marketing page cannot live inside `(site)`'s `max-w-6xl` gutter, and the rule
 * for this build was to change nothing outside this directory. It therefore
 * renders straight off the root layout (fonts, theme bootstrap, providers) with
 * its own chrome — same pattern as `app/board-image` and `app/activity`.
 *
 * Guard: `(admin)` has no shared layout, so every admin subtree gates itself
 * (CLAUDE.md rule 5). This one is superadmin-only — signed-out visitors get the
 * 401 interrupt, signed-in non-staff the 403.
 */
export const metadata: Metadata = {
  title: "Landing page prototype",
  // Prototype: must never be indexed or previewed while it lives at this path.
  robots: { index: false, follow: false, nocache: true },
};

export default async function TestHeroLayout({ children }: { children: React.ReactNode }) {
  await requireSuperadmin("/test-hero");
  return <div className="th-page">{children}</div>;
}
