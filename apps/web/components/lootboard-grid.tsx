"use client";

/**
 * Native (React-rendered) lootboard (FRONTEND_PLAN.md §12). Renders live loot as
 * an interactive grid — hover a tile for name/qty/value, tiles colored by GP
 * value — instead of a generated PNG. The PNG generator stays available as a
 * "Download image" share affordance.
 */
import { useState, useTransition } from "react";
import type { Lootboard } from "@droptracker/api-types";
import { lootValueClass } from "@/lib/format";
import { generateLootboardImage } from "@/app/(public)/groups/[id]/lootboard/actions";
import { EmptyState } from "@/components/ui";

export function LootboardGrid({ board }: { board: Lootboard }) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  const onDownload = () =>
    startTransition(async () => {
      setNotice(null);
      const { url } = await generateLootboardImage(board.group_id, board.period);
      if (url) window.open(url, "_blank");
      else setNotice("Image generation isn't configured in this environment (mock mode).");
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-osrs-parchment-dark/70 text-sm">Total loot</span>
          <span className="text-osrs-gold-bright ml-2 text-xl font-bold tabular-nums">
            {board.total.value_formatted}
          </span>
        </div>
        <button
          onClick={onDownload}
          disabled={pending}
          className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {pending ? "Generating…" : "Download image"}
        </button>
      </div>

      {notice && <p className="text-osrs-parchment-dark/70 text-sm">{notice}</p>}

      {board.items.length === 0 ? (
        <EmptyState title="No loot tracked for this period yet" />
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {board.items.map((it) => (
            <li
              key={it.item_id}
              className={`group relative flex aspect-square flex-col items-center justify-center rounded border p-2 text-center ${lootValueClass(
                it.value.value,
              )}`}
            >
              {it.icon_url ? (
                <img src={it.icon_url} alt={it.name} className="h-10 w-10 object-contain" />
              ) : (
                <span className="text-osrs-parchment/90 line-clamp-2 text-xs font-medium">
                  {it.name}
                </span>
              )}
              {it.quantity > 1 && (
                <span className="text-osrs-gold-bright absolute right-1 top-1 text-[10px] font-bold tabular-nums">
                  {it.quantity > 999 ? `${Math.floor(it.quantity / 1000)}k` : it.quantity}
                </span>
              )}
              <span className="text-osrs-parchment-dark/70 mt-1 text-[10px] tabular-nums">
                {it.value.value_formatted}
              </span>

              {/* Hover tooltip */}
              <div className="bg-osrs-brown-dark border-osrs-bronze/50 pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max max-w-[12rem] -translate-x-1/2 rounded border px-2 py-1 text-left text-xs shadow-lg group-hover:block">
                <div className="text-osrs-gold-bright font-medium">{it.name}</div>
                <div className="text-osrs-parchment-dark/80">
                  {it.quantity}× · {it.value.value_formatted}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
