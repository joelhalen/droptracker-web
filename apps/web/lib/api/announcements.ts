import { apiGet, apiSend, withFallback } from "./_client";
import {
  AnnouncementPageSchema,
  AnnouncementSchema,
  type Announcement,
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


  async createAnnouncement(input: AnnouncementInput): Promise<{ id: number }> {
    const path =
      input.scope_type === "group" && input.group_id
        ? `/groups/${input.group_id}/announcements`
        : `/announcements`;
    return withFallback(
      async () => (await apiSend("POST", path, input)) as { id: number },
      () => ({ id: Math.floor(Math.random() * 100000) }),
    );
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
