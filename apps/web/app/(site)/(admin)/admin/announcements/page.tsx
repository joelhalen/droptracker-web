import type { Metadata } from "next";
import { api } from "@/lib/api";
import { AnnouncementComposer } from "@/components/announcement-composer";
import { AnnouncementList } from "@/components/announcement-list";
import { AnnouncementReviewQueue } from "@/components/announcement-review-queue";
import { requireSuperadmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Global news" };

export default async function AdminAnnouncementsPage() {
  await requireSuperadmin("/admin/announcements");
  const [existing, queue] = await Promise.all([
    api.announcements("global"),
    api.announcementReviewQueue(),
  ]);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
          Waiting for review ({queue.items.length})
        </h2>
        <AnnouncementReviewQueue items={queue.items} canApprove={queue.can_approve} />
      </section>
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
    </div>
  );
}
