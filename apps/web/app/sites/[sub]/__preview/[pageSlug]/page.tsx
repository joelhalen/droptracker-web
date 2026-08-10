/**
 * Draft preview on the real tenant host: `/__preview/{pageSlug}?token=...`.
 * The token is a short-lived HMAC minted by the builder API for group admins;
 * the backend returns draft_blocks only when it validates. Always dynamic —
 * drafts must never enter the static cache.
 */
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { SiteBlockRenderer } from "@/components/site-blocks/renderer";

export const dynamic = "force-dynamic";

type Params = Promise<{ sub: string; pageSlug: string }>;
type Search = Promise<{ token?: string }>;

export const metadata = { robots: { index: false, follow: false } };

export default async function TenantPreviewPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { sub, pageSlug } = await params;
  const { token } = await searchParams;
  if (!token) notFound();
  const page = await api.sitePage(sub, pageSlug, { previewToken: token }).catch(() => null);
  if (!page) notFound();
  const group = await api.group(page.group_id);
  return (
    <div>
      <div className="border-osrs-gold/50 bg-osrs-surface-2 text-osrs-gold mb-6 rounded-lg border px-4 py-2 text-sm font-medium">
        Draft preview — this is not the published page.
      </div>
      {page.custom_css ? <style dangerouslySetInnerHTML={{ __html: page.custom_css }} /> : null}
      <SiteBlockRenderer blocks={page.blocks} group={group} />
    </div>
  );
}
