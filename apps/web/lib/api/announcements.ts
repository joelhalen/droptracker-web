import { apiGet, apiSend, withFallback } from "./_client";
import {
  AnnouncementPageSchema,
  AnnouncementReviewQueueSchema,
  AnnouncementSchema,
  type Announcement,
  type AnnouncementReviewQueue,
  type AnnouncementInput,
  type AnnouncementPage,
} from "@droptracker/api-types";
import {
  mockAnnouncements,
} from "../mock-data";

export const announcementsApi = {

  async announcements(scope = "global"): Promise<AnnouncementPage> {
    return withFallback(
      async () =>
        AnnouncementPageSchema.parse(
          await apiGet(`/announcements?scope=${encodeURIComponent(scope)}`, { revalidate: 30 }),
        ),
      () => mockAnnouncements(scope),
    );
  },


  /** `status` is "draft" when a site-wide post went to the owner's review
   * queue instead of being published (web129a). */
  async createAnnouncement(input: AnnouncementInput): Promise<{ id: number; status: string }> {
    const path =
      input.scope_type === "group" && input.group_id
        ? `/groups/${input.group_id}/announcements`
        : `/announcements`;
    return withFallback(
      async () => {
        const res = (await apiSend("POST", path, input)) as { id: number; status?: string };
        return { id: res.id, status: res.status ?? "published" };
      },
      () => ({ id: Math.floor(Math.random() * 100000), status: "published" }),
    );
  },

  /** Site-wide drafts waiting for the owner's review. Staff only, never cached. */
  async announcementReviewQueue(): Promise<AnnouncementReviewQueue> {
    return AnnouncementReviewQueueSchema.parse(
      await apiGet("/announcements/review", { authed: true }),
    );
  },

  /** Approve a draft, with any last edits, and publish it. Approvers only. */
  async approveAnnouncement(
    id: number,
    patch: Partial<Pick<Announcement, "title" | "body_md" | "pinned">> & { post_to_discord?: boolean },
  ): Promise<Announcement> {
    return AnnouncementSchema.parse(await apiSend("POST", `/announcements/${id}/approve`, patch));
  },


  async updateAnnouncement(
    id: number,
    patch: Partial<Pick<Announcement, "title" | "body_md" | "pinned" | "cover_image_url">>,
  ): Promise<Announcement> {
    return withFallback(
      async () => AnnouncementSchema.parse(await apiSend("PATCH", `/announcements/${id}`, patch)),
      () => ({
        id,
        scope_type: "global" as const,
        title: "",
        body_md: "",
        pinned: false,
        published_at: 0,
        ...patch,
      }),
    );
  },


  async archiveAnnouncement(id: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/announcements/${id}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },
};
