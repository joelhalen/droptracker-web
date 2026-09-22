import { apiGet, apiSend, withFallback } from "./_client";
import {
  AdminPopupNoticeDetailSchema,
  AdminPopupNoticeListSchema,
  AdminPopupNoticeSchema,
  MyNoticesSchema,
  NoticeAudiencePreviewSchema,
  NoticeLookupSchema,
  NoticeOptionsSchema,
  type AdminPopupNotice,
  type AdminPopupNoticeDetail,
  type AdminPopupNoticeList,
  type MyNotices,
  type NoticeAudiencePreview,
  type NoticeLookupHit,
  type NoticeOptions,
  type NoticeRule,
  type PopupNoticeInput,
} from "@droptracker/api-types";

/**
 * Targeted site pop-ups (web118a). Visitor reads/writes are session-scoped;
 * every `admin*` call is superadmin-gated by the backend.
 */
export const noticesApi = {
  // --- Visitor -------------------------------------------------------------
  /** Live notices this user matches and hasn't closed. Never cached. */
  async myNotices(): Promise<MyNotices> {
    return withFallback(
      async () => MyNoticesSchema.parse(await apiGet(`/me/notices`, { authed: true })),
      () => ({ items: [] }),
    );
  },

  async markNoticesSeen(ids: number[]): Promise<void> {
    await apiSend("POST", `/me/notices/seen`, { ids });
  },

  async dismissNotices(ids: number[]): Promise<void> {
    await apiSend("POST", `/me/notices/dismiss`, { ids });
  },

  // --- Admin ---------------------------------------------------------------
  async adminNotices(): Promise<AdminPopupNoticeList> {
    return withFallback(
      async () => AdminPopupNoticeListSchema.parse(await apiGet(`/admin/notices`, { authed: true })),
      () => ({ items: [], labels: { users: {}, groups: {}, tiers: {} } }),
    );
  },

  async adminNotice(id: number): Promise<AdminPopupNoticeDetail> {
    return AdminPopupNoticeDetailSchema.parse(await apiGet(`/admin/notices/${id}`, { authed: true }));
  },

  async adminCreateNotice(input: PopupNoticeInput & { send: boolean }): Promise<AdminPopupNotice> {
    return AdminPopupNoticeSchema.parse(await apiSend("POST", `/admin/notices`, input));
  },

  async adminUpdateNotice(id: number, patch: Partial<PopupNoticeInput>): Promise<AdminPopupNotice> {
    return AdminPopupNoticeSchema.parse(await apiSend("PATCH", `/admin/notices/${id}`, patch));
  },

  async adminSendNotice(id: number): Promise<AdminPopupNotice> {
    return AdminPopupNoticeSchema.parse(await apiSend("POST", `/admin/notices/${id}/send`, {}));
  },

  async adminEndNotice(id: number): Promise<AdminPopupNotice> {
    return AdminPopupNoticeSchema.parse(await apiSend("POST", `/admin/notices/${id}/end`, {}));
  },

  async adminDeleteNotice(id: number): Promise<{ ok: true }> {
    await apiSend("DELETE", `/admin/notices/${id}`, {});
    return { ok: true } as const;
  },

  async adminNoticeAudiencePreview(audience: NoticeRule[]): Promise<NoticeAudiencePreview> {
    return NoticeAudiencePreviewSchema.parse(
      await apiSend("POST", `/admin/notices/audience-preview`, { audience }),
    );
  },

  async adminNoticeOptions(): Promise<NoticeOptions> {
    return withFallback(
      async () => NoticeOptionsSchema.parse(await apiGet(`/admin/notices/options`, { authed: true })),
      () => ({ tiers: [], free_tier: "free" }),
    );
  },

  async adminNoticeLookup(kind: "user" | "group", q: string): Promise<NoticeLookupHit[]> {
    const qs = `kind=${kind}&q=${encodeURIComponent(q)}`;
    return NoticeLookupSchema.parse(await apiGet(`/admin/notices/lookup?${qs}`, { authed: true })).items;
  },
};
