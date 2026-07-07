/**
 * Docs grouping helper. Docs pages themselves are DB-backed (superadmin CMS,
 * `/admin/docs`) and fetched via `api.docs()`/`api.doc(slug)` — this file just
 * groups the flat list by category for the sidebar/index page, replacing the
 * old build-time filesystem loader that read `content/docs/*.mdx`.
 */
import type { DocSummary } from "@droptracker/api-types";

/** Preferred reading order for known categories; anything else sorts after, alphabetically. */
const CATEGORY_ORDER = ["Getting started", "Account", "Groups", "Events", "Reference"];

/** Docs grouped by category (reader-friendly category order, API's order within). */
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
  const rank = (c: string) => {
    const i = CATEGORY_ORDER.indexOf(c);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  return groups.sort(
    (a, b) => rank(a.category) - rank(b.category) || a.category.localeCompare(b.category),
  );
}
