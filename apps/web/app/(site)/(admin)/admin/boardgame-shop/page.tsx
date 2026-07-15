import type { Metadata } from "next";
import { api } from "@/lib/api";
import { ShopCatalogManager } from "@/components/admin/shop-catalog-manager";

export const metadata: Metadata = { title: "Board-game shop" };

export default async function AdminBoardgameShopPage() {
  const items = await api.adminShopItems();

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        The site-wide power-up catalog for board-game events. Inactive rows never appear in
        any event&apos;s shop; group leaders can further restrict items per event from their
        board settings. Effects marked &ldquo;coming soon&rdquo; have no handler yet — keep
        them inactive until their update ships.
      </p>
      <ShopCatalogManager initial={items} />
    </div>
  );
}
