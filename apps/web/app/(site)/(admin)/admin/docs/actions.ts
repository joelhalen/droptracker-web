"use server";

import { revalidatePath } from "next/cache";
import { DocInputSchema, type Doc, type DocInput } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

function revalidateDocs(slug?: string) {
  revalidatePath("/admin/docs");
  revalidatePath("/docs");
  if (slug) revalidatePath(`/docs/${slug}`);
}

/** Server Action: fetch the full doc (incl. content) for the edit form — the
 * list view only carries summaries. */
export async function getDocForEdit(slug: string): Promise<Doc | null> {
  await requireSuperadmin("/admin/docs");
  return api.doc(slug);
}

/** Server Action: create a docs page. Superadmin only. */
export async function createDoc(input: DocInput): Promise<{ id: number }> {
  await requireSuperadmin("/admin/docs");
  const parsed = DocInputSchema.parse(input);
  const result = await api.adminCreateDoc(parsed);
  revalidateDocs(parsed.slug);
  return result;
}

/** Server Action: update a docs page. Superadmin only. */
export async function updateDoc(slug: string, patch: Partial<DocInput>): Promise<Doc> {
  await requireSuperadmin("/admin/docs");
  const result = await api.adminUpdateDoc(slug, patch);
  revalidateDocs(slug);
  if (result.slug !== slug) revalidateDocs(result.slug);
  return result;
}

/** Server Action: delete a docs page. Superadmin only. */
export async function deleteDoc(slug: string): Promise<{ ok: true }> {
  await requireSuperadmin("/admin/docs");
  const result = await api.adminDeleteDoc(slug);
  revalidateDocs(slug);
  return result;
}
