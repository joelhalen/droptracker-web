import type { Metadata } from "next";
import { api } from "@/lib/api";
import { ItemValueManager } from "@/components/admin/item-value-manager";

export const metadata: Metadata = { title: "Item values" };

export default async function AdminItemValuesPage() {
  const [overrides, exported] = await Promise.all([
    api.adminItemValues(),
    api.adminItemValuesExport(),
  ]);

  return (
    <div className="w-full min-w-0">
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Post-submission valuation rules for items dropped with a 0gp in-game value because they are a
        component of a tradeable item (e.g. a bludgeon axon is worth ⅓ of an Abyssal bludgeon). Each
        rule values an item as{" "}
        <code className="text-osrs-parchment">(Σ component price × quantity + bonus) ÷ divisor</code>,
        with a flat fallback used when a component can’t be priced. Edits apply to live drop processing
        within ~15 seconds — no restart. These rules also power the public{" "}
        <a href="/item-values" className="text-osrs-gold-bright hover:underline">
          /item-values
        </a>{" "}
        page and the plugin’s valued-items list.
      </p>
      <ItemValueManager overrides={overrides} exportTxt={exported.txt} />
    </div>
  );
}
