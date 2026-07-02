import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { AnnouncementComposer } from "@/components/announcement-composer";
import { AnnouncementList } from "@/components/announcement-list";

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
        <AnnouncementList items={existing.items} groupId={groupId} />
      </section>
    </div>
  );
}
