import Link from "next/link";

export default function NotFound() {
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
