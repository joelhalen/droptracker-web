"use client";

import { useState, useTransition } from "react";
import type { AdminShopItem } from "@droptracker/api-types";
import { patchShopItem } from "@/app/(site)/(admin)/admin/boardgame-shop/actions";
import { Alert, Card } from "@/components/ui";
import { ItemDbIcon } from "@/components/item-db-icon";

/** Effects with live handlers (P2); the rest ship dark until P3. */
const LIVE_EFFECTS = new Set(["skip_task", "reroll_task", "boost_coins"]);

/** Superadmin editor for the board-game power-up catalog (web45a): per-row
 * active toggle + inline price/cooldown/icon edits. */
export function ShopCatalogManager({ initial }: { initial: AdminShopItem[] }) {
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const patch = (id: number, p: Record<string, unknown>) => {
    setError(null);
    startTransition(async () => {
      const res = await patchShopItem(id, p);
      if (res.ok) {
        setRows((prev) => prev.map((r) => (r.id === res.row.id ? res.row : r)));
      } else {
        setError(res.error);
      }
    });
  };

  const field =
    "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-2 py-1 text-sm outline-none";

  return (
    <Card padding="p-0">
      {error && (
        <div className="p-4 pb-0">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-osrs-parchment-dark/60 border-osrs-bronze/20 border-b text-left text-xs uppercase">
              <th className="px-4 py-2">Item</th>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Effect</th>
              <th className="px-2 py-2">Cost</th>
              <th className="px-2 py-2">Cooldown</th>
              <th className="px-2 py-2">Icon id</th>
              <th className="px-2 py-2">Active</th>
            </tr>
          </thead>
          <tbody className="divide-osrs-bronze/15 divide-y">
            {rows.map((r) => (
              <tr key={r.id} className={r.active ? "" : "opacity-60"}>
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2">
                    <ItemDbIcon itemId={r.icon_item_id} size={20} />
                    <span>
                      <span className="text-osrs-parchment block font-medium">{r.name}</span>
                      <span className="text-osrs-parchment-dark/50 block text-xs">
                        {r.description}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="text-osrs-parchment-dark/80 px-2 py-2 text-xs">{r.item_type}</td>
                <td className="px-2 py-2 text-xs">
                  <code className="text-osrs-parchment-dark/80">{r.effect}</code>
                  {!LIVE_EFFECTS.has(r.effect) && (
                    <span className="text-osrs-parchment-dark/50 ml-1 text-[10px] uppercase">
                      coming soon
                    </span>
                  )}
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min={0}
                    defaultValue={r.cost_coins}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isInteger(v) && v >= 0 && v !== r.cost_coins)
                        patch(r.id, { cost_coins: v });
                    }}
                    className={`${field} w-20`}
                    disabled={pending}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={r.type_cooldown_turns}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isInteger(v) && v >= 0 && v !== r.type_cooldown_turns)
                        patch(r.id, { type_cooldown_turns: v });
                    }}
                    className={`${field} w-16`}
                    disabled={pending}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min={1}
                    defaultValue={r.icon_item_id ?? ""}
                    onBlur={(e) => {
                      const raw = e.target.value.trim();
                      const v = raw ? Number(raw) : null;
                      if (v !== (r.icon_item_id ?? null)) patch(r.id, { icon_item_id: v });
                    }}
                    className={`${field} w-24`}
                    disabled={pending}
                  />
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={r.active}
                    disabled={pending}
                    onClick={() => patch(r.id, { active: !r.active })}
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                      r.active ? "bg-osrs-gold" : "bg-osrs-stone/50"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 size-4 transform rounded-full bg-white shadow transition-transform ${
                        r.active ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
