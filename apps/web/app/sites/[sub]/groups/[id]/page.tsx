/**
 * Tenant-branded group profile (sites-v1) — same wrapper pattern as
 * ../players/[id]: entity links from clan-site widgets stay inside the
 * tenant shell instead of falling through to DropTracker chrome.
 */
import type { Metadata } from "next";
import GroupPage, {
  generateMetadata as groupMetadata,
} from "@/app/(site)/(public)/groups/[id]/page";

export const revalidate = 30;

type Params = Promise<{ sub: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  return groupMetadata({ params: Promise.resolve({ id }) });
}

export default async function TenantGroupPage({ params }: { params: Params }) {
  const { id } = await params;
  return <GroupPage params={Promise.resolve({ id })} />;
}
