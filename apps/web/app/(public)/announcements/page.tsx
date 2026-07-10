import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/ui";
import { ScrollPanel } from "@/components/scroll-panel";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "News & Announcements",
  description: "DropTracker announcements and update threads.",
};

export default async function AnnouncementsPage() {
  const news = await api.announcements("global");

  return (
    <div>
      {news.items.length === 0 ? (
        <div className="space-y-6">
          <h1 className="text-osrs-gold text-3xl font-bold">News &amp; Announcements</h1>
          <EmptyState title="No announcements yet" hint="Check back soon for DropTracker news and updates." />
        </div>
      ) : (
        <ScrollPanel>
          <h1 className="ink-heading mb-6 text-center text-2xl font-bold sm:text-3xl">
            News &amp; Announcements
          </h1>
          <ul>
            {news.items.map((a) => (
              <li key={a.id} className="ink-rule border-b py-4 first:border-t">
                <div className="flex items-center gap-2">
                  {a.pinned && (
                    <span className="ink-heading ink-rule rounded border px-1.5 py-0.5 text-xs font-semibold">
                      Pinned
                    </span>
                  )}
                  <Link href={`/announcements/${a.id}`} className="ink-link text-lg font-semibold">
                    {a.title}
                  </Link>
                </div>
                <p className="mt-2 line-clamp-2 text-sm">{a.body_md}</p>
                {a.author_name && <p className="ink-muted mt-2 text-xs">— {a.author_name}</p>}
              </li>
            ))}
          </ul>
        </ScrollPanel>
      )}
    </div>
  );
}
