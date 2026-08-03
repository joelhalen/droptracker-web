"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";
import type {
  KnownIssue,
  KnownIssueCategory,
  KnownIssueCategoryInput,
  KnownIssueInput,
  StatusServices,
} from "@/lib/known-issues";

function revalidateStatus() {
  revalidatePath("/admin/status");
}

export async function createStatusCategory(
  input: KnownIssueCategoryInput,
): Promise<KnownIssueCategory> {
  await requireSuperadmin("/admin/status");
  const created = await api.adminCreateStatusCategory(input);
  revalidateStatus();
  return created;
}

export async function updateStatusCategory(
  id: number,
  patch: Partial<KnownIssueCategoryInput>,
): Promise<KnownIssueCategory> {
  await requireSuperadmin("/admin/status");
  const updated = await api.adminUpdateStatusCategory(id, patch);
  revalidateStatus();
  return updated;
}

export async function deleteStatusCategory(id: number): Promise<{ ok: true }> {
  await requireSuperadmin("/admin/status");
  const result = await api.adminDeleteStatusCategory(id);
  revalidateStatus();
  return result;
}

export async function createStatusIssue(input: KnownIssueInput): Promise<KnownIssue> {
  await requireSuperadmin("/admin/status");
  const created = await api.adminCreateStatusIssue(input);
  revalidateStatus();
  return created;
}

export async function updateStatusIssue(
  id: number,
  patch: Partial<KnownIssueInput>,
): Promise<KnownIssue> {
  await requireSuperadmin("/admin/status");
  const updated = await api.adminUpdateStatusIssue(id, patch);
  revalidateStatus();
  return updated;
}

export async function deleteStatusIssue(id: number): Promise<{ ok: true }> {
  await requireSuperadmin("/admin/status");
  const result = await api.adminDeleteStatusIssue(id);
  revalidateStatus();
  return result;
}

/** Fresh services snapshot for the health strip's refresh button. */
export async function refreshStatusServices(): Promise<StatusServices> {
  await requireSuperadmin("/admin/status");
  const summary = await api.statusSummary();
  return summary.services;
}
