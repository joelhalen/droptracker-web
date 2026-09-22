"use server";

/**
 * Server actions for /admin/notices (web118a). Superadmin only: mutations
 * re-assert it here, and the backend enforces it on every route regardless.
 * The frequent composer reads (audience count, pickers) skip the extra `/me`
 * round trip and lean on the backend's 403.
 */
import { revalidatePath } from "next/cache";
import {
  PopupNoticeInputSchema,
  NoticeRuleSchema,
  type AdminPopupNotice,
  type AdminPopupNoticeDetail,
  type NoticeAudiencePreview,
  type NoticeLookupHit,
  type NoticeRule,
  type PopupNoticeInput,
} from "@droptracker/api-types";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

const PATH = "/admin/notices";

export async function createNotice(input: PopupNoticeInput, send: boolean): Promise<AdminPopupNotice> {
  await requireSuperadmin(PATH);
  const parsed = PopupNoticeInputSchema.parse(input);
  const created = await api.adminCreateNotice({ ...parsed, send });
  revalidatePath(PATH);
  return created;
}

export async function updateNotice(id: number, input: PopupNoticeInput): Promise<AdminPopupNotice> {
  await requireSuperadmin(PATH);
  const parsed = PopupNoticeInputSchema.parse(input);
  const updated = await api.adminUpdateNotice(id, parsed);
  revalidatePath(PATH);
  return updated;
}

export async function sendNotice(id: number): Promise<AdminPopupNotice> {
  await requireSuperadmin(PATH);
  const sent = await api.adminSendNotice(id);
  revalidatePath(PATH);
  return sent;
}

export async function endNotice(id: number): Promise<AdminPopupNotice> {
  await requireSuperadmin(PATH);
  const ended = await api.adminEndNotice(id);
  revalidatePath(PATH);
  return ended;
}

export async function deleteNotice(id: number): Promise<{ ok: true }> {
  await requireSuperadmin(PATH);
  const result = await api.adminDeleteNotice(id);
  revalidatePath(PATH);
  return result;
}

export async function loadNoticeDetail(id: number): Promise<AdminPopupNoticeDetail> {
  return api.adminNotice(id);
}

export async function previewNoticeAudience(rules: NoticeRule[]): Promise<NoticeAudiencePreview> {
  return api.adminNoticeAudiencePreview(NoticeRuleSchema.array().min(1).parse(rules));
}

export async function lookupNoticeTargets(kind: "user" | "group", q: string): Promise<NoticeLookupHit[]> {
  if (kind !== "user" && kind !== "group") return [];
  const query = q.trim().slice(0, 64);
  if (!query) return [];
  return api.adminNoticeLookup(kind, query);
}
