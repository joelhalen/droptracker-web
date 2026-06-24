import type { Metadata, Route } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Site admin" };

const CARDS: { href: Route; title: string; desc: string }[] = [
  { href: "/admin/announcements", title: "Global news", desc: "Publish site-wide announcements." },
  { href: "/admin/discord", title: "Discord sender", desc: "Send a message to any channel via the bot." },
  { href: "/admin/services", title: "Services", desc: "Start/stop/restart backend services; view logs." },
  { href: "/admin/lookup", title: "Lookup", desc: "Cross-content search across players, groups, drops…" },
  { href: "/admin/tiers", title: "Subscription tiers", desc: "Create and edit premium tiers." },
];

export default function SuperadminOverview() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {CARDS.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          className="border-osrs-bronze/20 hover:border-osrs-gold/50 rounded border p-4 transition-colors"
        >
          <div className="text-osrs-gold-bright font-medium">{c.title}</div>
          <div className="text-osrs-parchment-dark/70 mt-1 text-sm">{c.desc}</div>
        </Link>
      ))}
    </div>
  );
}
