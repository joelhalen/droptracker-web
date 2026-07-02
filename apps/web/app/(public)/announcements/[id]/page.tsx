import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { Markdown } from "@/components/markdown";

export const revalidate = 30;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const { items } = await api.announcements("global");
  const item = items.find((a) => a.id === Number(id));
  return { title: item?.title ?? "Announcement", description: item?.body_md.slice(0, 160) };
}

export default async function AnnouncementPage({ params }: { params: Params }) {
  const { id } = await params;
  const { items } = await api.announcements("global");
  const item = items.find((a) => a.id === Number(id));
  if (!item) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: item.title,
    datePublished: new Date(item.published_at * 1000).toISOString(),
    author: item.author_name ? { "@type": "Organization", name: item.author_name } : undefined,
  };

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header>
        <h1 className="text-osrs-gold text-3xl font-bold">{item.title}</h1>
        <p className="text-osrs-parchment-dark/60 mt-2 text-sm">
          {new Date(item.published_at * 1000).toLocaleDateString()}
          {item.author_name ? ` · ${item.author_name}` : ""}
        </p>
      </header>
      <Markdown>{item.body_md}</Markdown>
    </article>
  );
}
