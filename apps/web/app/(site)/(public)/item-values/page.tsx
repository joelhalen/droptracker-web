import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { ItemDbIcon } from "@/components/item-db-icon";
import { EmptyState } from "@/components/ui";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Item values",
  description:
    "How DropTracker values items that are dropped with a 0gp in-game value because they are a component of a tradeable item.",
};

export default async function ItemValuesPage() {
  const items = await api.itemValues();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-osrs-gold text-3xl font-bold">Item values</h1>
        <p className="text-osrs-parchment-dark/80 mt-2 max-w-2xl">
          Some items are dropped with a <strong>0&nbsp;gp</strong> in-game value even though they are
          worth something, because they are a <em>component</em> of a tradeable item. After a drop is
          submitted, DropTracker re-values these using live Grand Exchange prices so they count fairly
          toward loot totals, leaderboards, and notification thresholds. The current rules and their
          live values are below.
        </p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing to show yet"
          hint="No post-submission item valuations are configured right now."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="border-osrs-bronze/30 text-osrs-parchment-dark/70 border-b text-left">
                <th className="py-2 pr-4 font-medium">Item</th>
                <th className="py-2 pr-4 font-medium">How it’s valued</th>
                <th className="py-2 pr-4 text-right font-medium">Current value</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr
                  key={`${it.item_id ?? it.item_name}`}
                  className="border-osrs-bronze/15 border-b align-top"
                >
                  <td className="text-osrs-parchment py-3 pr-4 font-medium">
                    <span className="inline-flex items-center gap-2">
                      <ItemDbIcon itemId={it.item_id} size={24} />
                      {it.item_name}
                    </span>
                  </td>
                  <td className="text-osrs-parchment-dark/80 py-3 pr-4">
                    <div>{it.description || it.formula}</div>
                    {it.description && (
                      <div className="text-osrs-parchment-dark/50 mt-0.5 text-xs">{it.formula}</div>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    <span className="text-osrs-gold-bright">{it.value.value_formatted}</span>
                    {!it.priced && <div className="text-osrs-parchment-dark/50 text-xs">fallback</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-osrs-parchment-dark/60 text-xs">
        Values refresh roughly every couple of minutes from live GE prices. See{" "}
        <Link href="/docs/how-it-works" className="text-osrs-gold-bright hover:underline">
          how it works
        </Link>{" "}
        for the full submission pipeline.
      </p>
    </div>
  );
}
