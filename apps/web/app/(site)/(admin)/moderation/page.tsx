import type { Metadata, Route } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Moderation" };

const TOOLS: { href: string; title: string; desc: string }[] = [
  {
    href: "/moderation/personal-bests",
    title: "PB blocks",
    desc: "Block NPCs that produce junk personal-best rows; blocking purges existing rows permanently.",
  },
  {
    href: "/moderation/item-values",
    title: "Item values",
    desc: "Maintain valuation rules for 0gp component items (e.g. bludgeon axon → ⅓ bludgeon).",
  },
  {
    href: "/moderation/task-library",
    title: "Event task library",
    desc: "Curate the shared pool of event task presets every clan's designer picks from.",
  },
];

export default function ModerationOverviewPage() {
  return (
    <div className="space-y-6">
      <p className="text-osrs-parchment-dark/70 max-w-2xl text-sm">
        Thanks for helping keep DropTracker's data clean. These tools act on live, site-wide data —
        changes take effect immediately for every player and group, so double-check before you
        delete. Each action is logged with your name for the site admins.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href as Route}
            className="border-osrs-bronze/20 hover:border-osrs-gold/50 rounded border p-4 transition-colors"
          >
            <div className="text-osrs-gold-bright font-medium">{t.title}</div>
            <div className="text-osrs-parchment-dark/70 mt-1 text-sm">{t.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
