"use client";

/**
 * The collection log, browsed the way it is in game: tabs across the top, the
 * pages of the selected tab down the left with their completion counts, and the
 * selected page's slots on the right.
 *
 * Unobtained slots are shown dimmed rather than omitted. A collection log that
 * only listed what you already have would answer the wrong question — the empty
 * slots are what a player is actually looking at.
 */
import { useMemo, useState } from "react";
import type { CollectionLogTab } from "@droptracker/api-types";
import { ItemDbIcon } from "@/components/item-db-icon";
import { OsrsItemSlot, completionTone } from "@/components/osrs-panel";

export function CollectionLogBrowser({ tabs }: { tabs: CollectionLogTab[] }) {
  const [tabName, setTabName] = useState(tabs[0]?.name ?? "");
  const tab = useMemo(
    () => tabs.find((t) => t.name === tabName) ?? tabs[0],
    [tabs, tabName],
  );
  const [pageName, setPageName] = useState<string | null>(null);

  const page = useMemo(() => {
    if (!tab) return null;
    return tab.pages.find((p) => p.name === pageName) ?? tab.pages[0] ?? null;
  }, [tab, pageName]);

  if (!tab) return null;

  return (
    <div>
      {/* Tab strip */}
      <div className="border-osrs-bronze/40 flex flex-wrap gap-1 border-b px-2 pt-2">
        {tabs.map((t) => (
          <button
            key={t.name}
            type="button"
            onClick={() => {
              setTabName(t.name);
              setPageName(null);
            }}
            aria-current={t.name === tab.name}
            className={`font-osrs rounded-t px-3 py-1.5 text-sm transition-colors ${
              t.name === tab.name
                ? "bg-osrs-bronze/30 text-osrs-gold-bright"
                : "text-osrs-parchment-dark/70 hover:bg-osrs-bronze/15"
            }`}
          >
            {t.name}
            <span className={`ml-2 text-xs ${completionTone(t.obtained, t.total)}`}>
              {t.obtained}/{t.total}
            </span>
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-[minmax(11rem,15rem)_1fr]">
        {/* Page list for the selected tab */}
        <div className="border-osrs-bronze/25 max-h-[34rem] overflow-y-auto border-b md:border-r md:border-b-0">
          {tab.pages.map((p) => {
            const selected = page?.name === p.name;
            const tone = completionTone(p.obtained, p.total);
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => setPageName(p.name)}
                className={`font-osrs flex w-full items-baseline justify-between gap-2 px-2 py-1 text-left text-sm leading-tight transition-colors ${
                  selected ? "bg-osrs-bronze/30" : "hover:bg-osrs-bronze/15"
                }`}
              >
                <span className={`truncate ${tone}`}>{p.name}</span>
                <span className={`shrink-0 tabular-nums ${tone}`}>
                  {p.obtained}/{p.total}
                </span>
              </button>
            );
          })}
        </div>

        {/* Slots of the selected page */}
        <div className="max-h-[34rem] overflow-y-auto p-3">
          {page && (
            <>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="font-osrs text-osrs-gold-bright text-base">{page.name}</h3>
                <span
                  className={`font-osrs text-sm ${completionTone(page.obtained, page.total)}`}
                >
                  Obtained: {page.obtained}/{page.total}
                </span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(46px,1fr))] gap-1.5">
                {page.items.map((item) => (
                  <OsrsItemSlot
                    key={item.item_id}
                    obtained={item.obtained}
                    title={
                      item.obtained
                        ? `${item.name}${item.quantity > 1 ? ` x${item.quantity.toLocaleString()}` : ""}`
                        : `${item.name} — not obtained`
                    }
                  >
                    <ItemDbIcon itemId={item.item_id} size={36} />
                    {item.obtained && item.quantity > 1 && (
                      <span
                        className="text-osrs-gold-bright font-osrs absolute top-0 left-0.5 text-[11px] leading-none"
                        style={{ textShadow: "1px 1px 0 #000" }}
                      >
                        {item.quantity > 99_999
                          ? `${Math.floor(item.quantity / 1000)}K`
                          : item.quantity}
                      </span>
                    )}
                  </OsrsItemSlot>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
