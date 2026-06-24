/**
 * Static MDX docs loader (FRONTEND_PLAN.md §19 item 8: "static MDX ships first").
 * Docs live as `.mdx` files under `content/docs/` with frontmatter. Read at build
 * time (pages are statically generated), so no runtime filesystem access.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const DOCS_DIR = path.join(process.cwd(), "content", "docs");

export interface DocMeta {
  slug: string;
  title: string;
  description?: string;
  category: string;
  order: number;
}

export interface Doc extends DocMeta {
  content: string;
}

async function readDocFile(file: string): Promise<Doc> {
  const raw = await fs.readFile(path.join(DOCS_DIR, file), "utf8");
  const { data, content } = matter(raw);
  return {
    slug: file.replace(/\.mdx?$/, ""),
    title: String(data.title ?? file),
    description: data.description ? String(data.description) : undefined,
    category: String(data.category ?? "General"),
    order: Number(data.order ?? 100),
    content,
  };
}

/** All docs, sorted by category then order. */
export async function getAllDocs(): Promise<Doc[]> {
  const files = (await fs.readdir(DOCS_DIR)).filter((f) => /\.mdx?$/.test(f));
  const docs = await Promise.all(files.map(readDocFile));
  return docs.sort((a, b) => a.category.localeCompare(b.category) || a.order - b.order);
}

export async function getDoc(slug: string): Promise<Doc | null> {
  const docs = await getAllDocs();
  return docs.find((d) => d.slug === slug) ?? null;
}

/** Docs grouped by category, preserving sort order. */
export async function getDocsByCategory(): Promise<{ category: string; docs: DocMeta[] }[]> {
  const docs = await getAllDocs();
  const groups: { category: string; docs: DocMeta[] }[] = [];
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
