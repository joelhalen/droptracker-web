import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { ScrollPanel } from "@/components/scroll-panel";
import { truncateMarkdown } from "@/lib/markdown-utils";

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
                <Link
                  href={`/announcements/${a.id}`}
                  className="block no-underline hover:opacity-90 transition-opacity"
                >
                  <div className="flex items-center gap-2">
                    {a.pinned && (
                      <span className="ink-heading ink-rule rounded border px-1.5 py-0.5 text-xs font-semibold">
                        Pinned
                      </span>
                    )}
                    <h2 className="ink-link text-lg font-semibold">{a.title}</h2>
                  </div>
                  <div className="mt-2 text-sm prose prose-scroll-ink prose-sm max-w-none">
                    <Markdown tone="ink">{truncateMarkdown(a.body_md, 75)}</Markdown>
                  </div>
                  {a.author_name && <p className="ink-muted mt-2 text-xs">— {a.author_name}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </ScrollPanel>
      )}
    </div>
  );
}
