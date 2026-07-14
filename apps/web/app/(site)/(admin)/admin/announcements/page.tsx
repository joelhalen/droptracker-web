import type { Metadata } from "next";
import { api } from "@/lib/api";
import { AnnouncementComposer } from "@/components/announcement-composer";
import { AnnouncementList } from "@/components/announcement-list";

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
        <AnnouncementList items={existing.items} />
      </section>
    </div>
  );
}
