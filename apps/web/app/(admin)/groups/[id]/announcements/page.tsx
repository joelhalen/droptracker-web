import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { AnnouncementComposer } from "@/components/announcement-composer";

export const metadata: Metadata = { title: "Announcements" };

type Params = Promise<{ id: string }>;

export default async function GroupAnnouncementsPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  const existing = await api.announcements(`group:${groupId}`);

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
          New announcement
        </h2>
        <AnnouncementComposer groupId={groupId} />
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
