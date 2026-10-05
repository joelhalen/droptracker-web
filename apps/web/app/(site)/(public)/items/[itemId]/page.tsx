import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { resolveRef } from "@/lib/entity-ref";
import { entityCanonical, entitySocialMetadata } from "@/lib/seo";
import { ItemProfile } from "@/components/item-profile";

export const revalidate = 60;

type Params = Promise<{ itemId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const ref = await resolveRef("item", (await params).itemId).catch(() => null);
  if (!ref || ref.ambiguous) return { title: "Item" };
  const item = await api.itemDetail(ref.id);
  if (!item) return { title: "Item" };
  const received = item.lifetime
    ? `: received ${item.lifetime.drop_count.toLocaleString("en-US")} times (${item.lifetime.loot.value_formatted} GP) on DropTracker`
    : "";
  return {
    ...entitySocialMetadata("items", item.item_id, {
      title: item.name,
      description: `${item.name}${received}. Recent receivers, top collectors and drop sources.`,
    }),
    alternates: entityCanonical("items", item.item_id, item.canonical_slug),
  };
}

export default async function ItemPage({ params }: { params: Params }) {
  const ref = await resolveRef("item", (await params).itemId);
  // Item names collapse to a primary id, so `ambiguous` never happens here.
  if (ref.ambiguous) notFound();
  const itemId = ref.id;

  const item = await api.itemDetail(itemId);
  if (!item) notFound();

  return <ItemProfile item={item} />;
}
