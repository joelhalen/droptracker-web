import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/ui";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "News & Announcements",
  description: "DropTracker announcements and update threads.",
};

export default async function AnnouncementsPage() {
  const news = await api.announcements("global");

  return (
    <div className="space-y-6">
      <h1 className="text-osrs-gold text-3xl font-bold">News &amp; Announcements</h1>
      {news.items.length === 0 && (
        <EmptyState title="No announcements yet" hint="Check back soon for DropTracker news and updates." />
      )}
      <ul className="space-y-4">
        {news.items.map((a) => (
          <li key={a.id} className="border-osrs-bronze/20 rounded border p-5">
            <div className="flex items-center gap-2">
              {a.pinned && (
                <span className="bg-osrs-gold/20 text-osrs-gold rounded px-1.5 py-0.5 text-xs">Pinned</span>
              )}
              <Link href={`/announcements/${a.id}`} className="text-osrs-gold-bright text-lg font-semibold">
                {a.title}
              </Link>
            </div>
            <p className="text-osrs-parchment-dark/80 mt-2 text-sm">{a.body_md}</p>
            {a.author_name && (
              <p className="text-osrs-parchment-dark/50 mt-3 text-xs">— {a.author_name}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
