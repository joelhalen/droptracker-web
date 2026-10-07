import type { Metadata } from "next";
import { api } from "@/lib/api";
import Link from "next/link";
import { Alert } from "@/components/ui";
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
      <Alert variant="info">
        New updates are written in{" "}
        <Link href="/admin/notices" className="text-osrs-gold-bright underline">
          Notices
        </Link>
        . A notice can be a targeted pop-up, a news post on this list, and a Discord post, and the
        owner approves each one before it goes out. This page keeps the published news posts.
      </Alert>
      {queue.items.length > 0 && (
        <section>
          <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
            Older posts waiting for review ({queue.items.length})
          </h2>
          <AnnouncementReviewQueue items={queue.items} canApprove={queue.can_approve} />
        </section>
      )}
      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">Published</h2>
        <AnnouncementList items={existing.items} />
      </section>
    </div>
  );
}
