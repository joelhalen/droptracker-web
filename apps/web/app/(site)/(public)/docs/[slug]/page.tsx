import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { docHeadings } from "@/lib/docs";
import { Markdown } from "@/components/markdown";
import { ScrollPanel } from "@/components/scroll-panel";

export const revalidate = 60;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const doc = await api.doc(slug);
  if (!doc) return {};
  return { title: doc.title, description: doc.description ?? undefined };
}

export default async function DocPage({ params }: { params: Params }) {
  const { slug } = await params;
  const doc = await api.doc(slug);
  if (!doc) notFound();

  // Long pages get a jump list; short ones read fine without it.
  const headings = docHeadings(doc.content);
  const showContents = headings.length >= 4;

  return (
    <ScrollPanel>
      {showContents && (
        <nav aria-label="On this page" className="ink-rule mb-6 border-b pb-4 text-sm">
          <div className="ink-muted mb-1.5 text-xs font-semibold tracking-wide uppercase">
            On this page
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {headings.map((h) => (
              <li key={h.id}>
                <a href={`#${h.id}`} className="ink-link">
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <Markdown tone="ink" headingIds>
        {doc.content}
      </Markdown>
    </ScrollPanel>
  );
}
