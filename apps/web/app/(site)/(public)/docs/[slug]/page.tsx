import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
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

  return (
    <ScrollPanel>
      <Markdown tone="ink">{doc.content}</Markdown>
    </ScrollPanel>
  );
}
