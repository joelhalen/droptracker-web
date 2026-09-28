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

/**
 * Anchor id for a docs heading. The backend's docs search points each hit at
 * a section by heading text and relies on this exact transform — mirror of
 * `heading_slug()` in the core repo's `web_api/docs_search.py`. Change both
 * together or search links stop landing on their section.
 */
export function headingSlug(text: string): string {
  return stripInlineMarkdown(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/`/g, "")
    .replace(/(\*{1,3}|_{2,3})/g, "");
}

/** A page's `##` headings, in order, for its "On this page" list. Headings
 * inside code fences are skipped, as the renderer does. */
export function docHeadings(markdown: string): { text: string; id: string }[] {
  const out: { text: string; id: string }[] = [];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    const m = !inFence && /^##\s+(.*?)\s*#*\s*$/.exec(line);
    if (m) {
      const text = stripInlineMarkdown(m[1] ?? "").trim();
      out.push({ text, id: headingSlug(text) });
    }
  }
  return out;
}

/** Site path for a docs search hit: the page, at its best section. */
export function docHitHref(hit: { slug: string; anchor: string | null }): string {
  return `/docs/${hit.slug}${hit.anchor ? `#${hit.anchor}` : ""}`;
}

/**
 * Split `text` into runs, flagging the ones that start with a word of the
 * query, for highlighting a search snippet. Same word-prefix rule the backend
 * ranks by ("join" lights up "joining", "ice" does not light up "dice").
 */
export function highlightRuns(text: string, query: string): { text: string; hit: boolean }[] {
  const words = [...new Set(query.toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter(
    (w) => w.length >= 2,
  );
  if (!words.length || !text) return text ? [{ text, hit: false }] : [];
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`\\b(?:${escaped.join("|")})[a-z0-9]*`, "gi");
  const out: { text: string; hit: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at), hit: false });
    out.push({ text: m[0], hit: true });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out;
}
