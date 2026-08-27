"use client";

/**
 * The collection log, browsed the way it is in game: tabs across the top, the
 * pages of the selected tab down the left with their completion counts, and the
 * selected page's slots on the right.
 *
 * Unobtained slots are shown dimmed rather than omitted. A collection log that
 * only listed what you already have would answer the wrong question — the empty
 * slots are what a player is actually looking at.
 *
 * Each slot carries a hover card, because a grid of icons is unreadable without
 * one: it names the slot, and where the player's own submission recorded the
 * unlock it dates it and shows the screenshot they sent. `details` is sparse —
 * most slots predate the plugin's involvement and have nothing but a name.
 */
import { useMemo, useState } from "react";
import type {
  CollectionLogDetail,
  CollectionLogItem,
  CollectionLogTab,
} from "@droptracker/api-types";
import { ItemDbIcon } from "@/components/item-db-icon";
import { HoverCard } from "@/components/hover-card";
import { OsrsItemSlot, completionTone } from "@/components/osrs-panel";
import { slotStatus } from "@/lib/collection-log";
import { formatDate } from "@/lib/format";

/** Wide enough for a 16:9 screenshot to read as one rather than as a smudge. */
const CARD_WIDTH = 300;

export function CollectionLogBrowser({
  tabs,
  details = {},
}: {
  tabs: CollectionLogTab[];
  details?: Record<string, CollectionLogDetail>;
}) {
  const [tabName, setTabName] = useState(tabs[0]?.name ?? "");
  const tab = useMemo(() => tabs.find((t) => t.name === tabName) ?? tabs[0], [tabs, tabName]);
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
                <span className={`font-osrs text-sm ${completionTone(page.obtained, page.total)}`}>
                  Obtained: {page.obtained}/{page.total}
                </span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(46px,1fr))] gap-1.5">
                {page.items.map((item) => (
                  <HoverCard
                    key={item.item_id}
                    // `block` so the card's trigger span behaves as the grid
                    // cell the slot div used to be — an inline wrapper would
                    // collapse the aspect-square sizing.
                    className="block cursor-help"
                    width={CARD_WIDTH}
                    content={<SlotCard item={item} detail={details[String(item.item_id)]} />}
                  >
                    <OsrsItemSlot obtained={item.obtained} label={item.name}>
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
                  </HoverCard>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * What one slot's hover card says. The name is always there; everything below
 * it depends on the player having unlocked this while running the plugin, which
 * most slots did not. A line we cannot fill is left out rather than printed as
 * "unknown" — an empty label is noise, and the absence already says it.
 */
function SlotCard({ item, detail }: { item: CollectionLogItem; detail?: CollectionLogDetail }) {
  return (
    <div className="p-3">
      <div className="flex items-center gap-2.5">
        <span
          className={`flex size-9 shrink-0 items-center justify-center ${
            item.obtained ? "" : "opacity-30 grayscale"
          }`}
        >
          <ItemDbIcon itemId={item.item_id} size={32} />
        </span>
        <div className="min-w-0">
          <div className="font-osrs text-osrs-gold-bright truncate text-sm">{item.name}</div>
          <div className="text-osrs-parchment-dark/60 text-xs">{slotStatus(item, detail)}</div>
        </div>
      </div>

      {detail?.ts != null && (
        <div className="border-osrs-bronze/25 text-osrs-parchment/90 mt-2.5 border-t pt-2.5 text-xs">
          Received {formatDate(detail.ts)}
        </div>
      )}

      {detail?.image_url && <SlotScreenshot url={detail.image_url} name={item.name} />}
    </div>
  );
}

/**
 * The screenshot from the submission, opening full size in a new tab.
 *
 * These are full-resolution client captures — a quarter of a megabyte each —
 * so it matters that the card body only mounts once the card is actually
 * opened. A slot never costs a request for a screenshot nobody looked at.
 *
 * Shown at its own aspect ratio rather than cropped to a fixed band: these are
 * whatever shape the player's client was, portrait ones included, and the part
 * that matters — the chat line announcing the unlock — is at an edge, which is
 * exactly what a crop eats. A tall one is handled by the card's own 80vh
 * scroll. A dead URL removes the figure rather than leaving a broken frame.
 */
function SlotScreenshot({ url, name }: { url: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="border-osrs-bronze/30 hover:border-osrs-gold-bright/60 mt-2.5 block overflow-hidden rounded border transition-colors"
      title="Open the full screenshot"
    >
      <img
        src={url}
        alt={`Screenshot of ${name} being unlocked`}
        loading="lazy"
        decoding="async"
        className="block h-auto w-full"
        onError={() => setBroken(true)}
      />
    </a>
  );
}
