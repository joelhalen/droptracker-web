import Link from "next/link";

/**
 * The 404 card itself, with no page frame around it. Rendered by both 404
 * boundaries: `app/(site)/not-found.tsx` (chrome comes from the (site) layout)
 * and `app/not-found.tsx` (which adds the chrome itself, since the (site)
 * layout never runs for a fully-unmatched URL).
 */
export function NotFoundView() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-osrs-gold text-5xl font-bold">404</h1>
      <p className="text-osrs-parchment-dark/80 mt-3">This page could not be found.</p>
      <Link href="/" className="text-osrs-gold-bright mt-6 inline-block hover:underline">
        ← Back to leaderboards
      </Link>
    </div>
  );
}
