/**
 * Docs grouping helper. Docs pages themselves are DB-backed (superadmin CMS,
 * `/admin/docs`) and fetched via `api.docs()`/`api.doc(slug)` — this file just
 * groups the flat list by category for the sidebar/index page, replacing the
 * old build-time filesystem loader that read `content/docs/*.mdx`.
 */
import type { DocSummary } from "@droptracker/api-types";

/** Docs grouped by category, preserving the API's category/order sort. */
export function groupDocsByCategory(docs: DocSummary[]): { category: string; docs: DocSummary[] }[] {
  const groups: { category: string; docs: DocSummary[] }[] = [];
  for (const doc of docs) {
    let group = groups.find((g) => g.category === doc.category);
    if (!group) {
      group = { category: doc.category, docs: [] };
      groups.push(group);
    }
    group.docs.push(doc);
  }
  return groups;
}
