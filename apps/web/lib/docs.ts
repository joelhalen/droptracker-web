/**
 * Docs grouping helper. Docs pages themselves are DB-backed (superadmin CMS,
 * `/admin/docs`) and fetched via `api.docs()`/`api.doc(slug)` — this file just
 * groups the flat list by category for the sidebar/index page, replacing the
 * old build-time filesystem loader that read `content/docs/*.mdx`.
 */
import type { DocSummary } from "@droptracker/api-types";

/** Preferred reading order for known categories; anything else sorts after, alphabetically. */
const CATEGORY_ORDER = ["Getting started", "Account", "Groups", "Events", "Reference", "Developers"];

/**
 * Doc pages that live in the repo rather than the CMS, and so are absent from
 * `api.docs()`.
 *
 * A page documenting code belongs in the same review as the code it describes,
 * which is why it is not CMS-authored (same reasoning as `/privacy`). But the
 * sidebar and index are built purely from the CMS list, so without this it
 * would be unreachable except by typing the URL.
 */
const REPO_DOCS: DocSummary[] = [
  {
    slug: "api",
    title: "Data API",
    description: "Read player and group data from your own app.",
    category: "Developers",
    order: 0,
  },
];

/** Docs grouped by category (reader-friendly category order, API's order within). */
export function groupDocsByCategory(docs: DocSummary[]): { category: string; docs: DocSummary[] }[] {
  const groups: { category: string; docs: DocSummary[] }[] = [];
  // A CMS doc that claims a repo slug would shadow the real route, so the
  // repo's own entry wins and the duplicate is dropped.
  const repoSlugs = new Set(REPO_DOCS.map((d) => d.slug));
  for (const doc of [...REPO_DOCS, ...docs.filter((d) => !repoSlugs.has(d.slug))]) {
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
