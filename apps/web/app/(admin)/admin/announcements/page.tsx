import type { Metadata } from "next";
import { api } from "@/lib/api";
import { AnnouncementComposer } from "@/components/announcement-composer";

export const metadata: Metadata = { title: "Global news" };

export default async function AdminAnnouncementsPage() {
  const existing = await api.announcements("global");

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
          New site-wide announcement
        </h2>
        <AnnouncementComposer />
      </section>

      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">Published</h2>
        {existing.items.length ? (
          <ul className="divide-osrs-bronze/20 divide-y">
            {existing.items.map((a) => (
              <li key={a.id} className="py-3">
                <div className="flex items-center gap-2">
                  {a.pinned && (
                    <span className="bg-osrs-gold/20 text-osrs-gold rounded px-1.5 py-0.5 text-xs">
                      Pinned
                    </span>
                  )}
                  <span className="font-medium">{a.title}</span>
                </div>
                <p className="text-osrs-parchment-dark/70 mt-1 line-clamp-2 text-sm">{a.body_md}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-osrs-parchment-dark/60 text-sm">No announcements yet.</p>
        )}
      </section>
    </div>
  );
}
