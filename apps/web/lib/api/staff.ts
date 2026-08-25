import { apiGet, apiSend, withFallback } from "./_client";
import {
  ChatThreadSchema,
  GroupNoticePageSchema,
  GroupNoticeSchema,
  StaffChatsPageSchema,
  StaffUserSearchSchema,
  type ChatThread,
  type GroupNotice,
  type GroupNoticePage,
  type StaffChatCreate,
  type StaffChatKind,
  type StaffChatsPage,
  type StaffUserSearch,
} from "@droptracker/api-types";
import {
  mockChatThreads,
  mockGroupNotices,
  mockResolvedGroupNotice,
  mockStaffChats,
  mockStaffUserHits,
} from "../mock-data";

export const staffApi = {

  // --- Staff surfaces (web102a phases 3–4) ---------------------------------
  // Developer/superadmin gating is the backend's on every route; the widget
  // only decides what to SHOW from `me` flags.

  /** Search users by display name / Discord id (developer or superadmin).
   * The backend returns empty items below two characters. */
  async staffUserSearch(q: string): Promise<StaffUserSearch> {
    return withFallback(
      async () =>
        StaffUserSearchSchema.parse(
          await apiGet(`/staff/users/search?q=${encodeURIComponent(q)}`, { authed: true }),
        ),
      () => mockStaffUserHits(q),
    );
  },

  /** Open (or reopen) the target's single staff_dm thread and post the
   * opening message; the backend also DMs them on Discord with a link back. */
  async createStaffChat(input: StaffChatCreate): Promise<ChatThread> {
    return withFallback(
      async () => ChatThreadSchema.parse(await apiSend("POST", `/staff/chats`, input)),
      () => mockChatThreads[1]!,
    );
  },

  /** Every thread of one kind, newest activity first (staff only). Defaults to
   * `staff_dm`; `event_invite` is the clan-vs-clan console. The rows are an
   * index only — see `StaffChatsPageSchema` on why their `can_post` lies. */
  async staffChats(
    params: { kind?: StaffChatKind; page?: number; limit?: number } = {},
  ): Promise<StaffChatsPage> {
    const qs = new URLSearchParams();
    if (params.kind) qs.set("kind", params.kind);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return withFallback(
      async () =>
        StaffChatsPageSchema.parse(await apiGet(`/staff/chats${suffix}`, { authed: true })),
      () => mockStaffChats(params.kind ?? "staff_dm"),
    );
  },

  /** The superadmin group-notice console. */
  async groupNotices(
    params: { status?: "open" | "resolved"; code?: string; group_id?: number; page?: number } = {},
  ): Promise<GroupNoticePage> {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.code) qs.set("code", params.code);
    if (params.group_id) qs.set("group_id", String(params.group_id));
    if (params.page) qs.set("page", String(params.page));
    const suffix = qs.toString() ? `?${qs}` : "";
    return withFallback(
      async () =>
        GroupNoticePageSchema.parse(
          await apiGet(`/admin/group-notices${suffix}`, { authed: true }),
        ),
      () => mockGroupNotices(),
    );
  },

  /** Manually resolve a notice (superadmin; 409 when already resolved). */
  async resolveGroupNotice(noticeId: number, note?: string): Promise<GroupNotice> {
    return withFallback(
      async () =>
        GroupNoticeSchema.parse(
          await apiSend("PATCH", `/admin/group-notices/${noticeId}`, {
            action: "resolve",
            ...(note ? { note } : {}),
          }),
        ),
      () => mockResolvedGroupNotice(noticeId),
    );
  },
};
