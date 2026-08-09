/**
 * Tenant landing page — renders the site's locked `home` page.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { SiteBlockRenderer } from "@/components/site-blocks/renderer";

export const revalidate = 60;

type Params = Promise<{ sub: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { sub } = await params;
  const page = await api.sitePage(sub, "home").catch(() => null);
  return page ? { title: page.title } : {};
}

export default async function TenantHomePage({ params }: { params: Params }) {
  const { sub } = await params;
  const page = await api.sitePage(sub, "home").catch(() => null);
  if (!page) notFound();
  const group = await api.group(page.group_id);
  return <SiteBlockRenderer blocks={page.blocks} group={group} />;
}
