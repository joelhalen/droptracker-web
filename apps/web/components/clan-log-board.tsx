"use client";

/**
 * The Clan Log board: every catalogued unique, per boss, obtained or missing.
 *
 * Two decisions carry the performance of this page, which renders ~350 icons
 * across ~60 sections (and will grow as content ships):
 *
 * 1. **One shared popover, not one per cell.** The Loot Sweep matrix mounted a
 *    HoverCard per cell and paid for it in scroll jank on big boards. Here a
 *    single fixed-position card is moved to whichever cell the pointer is over,
 *    fed from data already in the payload.
 * 2. **`content-visibility: auto` per category.** Off-screen categories skip
 *    layout and paint entirely; `contain-intrinsic-size` keeps the scrollbar
 *    honest so that skipping doesn't make the page jump.
 *
 * The missing state is deliberately worded "not seen by DropTracker" rather
 * than "never obtained" — a slot someone got before the clan was tracked is
 * indistinguishable from one nobody ever got, and the board should not claim
 * otherwise.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { ClanLog, ClanLogItem } from "@droptracker/api-types";
import { ItemDbIcon } from "@/components/item-db-icon";
import { Card } from "@/components/ui";
import {
  boardSummary,
  completionTone,
  formatObtainedAt,
  groupByCategory,
} from "@/lib/clan-log";

type HoverState = {
  item: ClanLogItem;
  section: string;
  left: number;
  top: number;
  above: boolean;
};

const CARD_WIDTH = 240;

export function ClanLogBoard({ board }: { board: ClanLog }) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const [missingOnly, setMissingOnly] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categories = useMemo(() => groupByCategory(board.sections), [board.sections]);
  const summary = boardSummary(board);

  const openCard = useCallback(
    (event: React.PointerEvent<HTMLElement>, item: ClanLogItem, section: string) => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      const rect = event.currentTarget.getBoundingClientRect();
      const above = rect.bottom + 150 > window.innerHeight;
      setHover({
        item,
        section,
        left: Math.min(
          Math.max(8, rect.left + rect.width / 2 - CARD_WIDTH / 2),
          Math.max(8, window.innerWidth - CARD_WIDTH - 8),
        ),
        top: above ? rect.top - 8 : rect.bottom + 8,
        above,
      });
    },
    [],
  );

  const closeCard = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHover(null), 80);
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-osrs-parchment/70 text-xs tracking-wide uppercase">
              Collection progress
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${completionTone(summary.pct)}`}>
                {summary.pct}%
              </span>
              <span className="text-osrs-parchment-dark text-sm">
                {summary.obtained} of {summary.total} slots
              </span>
            </div>
          </div>
          <label className="text-osrs-parchment-dark flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={missingOnly}
              onChange={(e) => setMissingOnly(e.target.checked)}
              className="accent-osrs-gold h-4 w-4"
            />
            Show only what&apos;s missing ({summary.missing})
          </label>
        </div>
        <div className="bg-osrs-bronze/20 mt-3 h-2 w-full overflow-hidden rounded-full">
          <div
            className="from-osrs-gold to-osrs-gold-bright h-full rounded-full bg-gradient-to-r transition-[width]"
            style={{ width: `${summary.pct}%` }}
          />
        </div>
      </Card>

      {categories.map((category) => {
        const sections = missingOnly
          ? category.sections.filter((s) => s.items.some((i) => !i.obtained))
          : category.sections;
        if (sections.length === 0) return null;

        return (
          // Off-screen categories skip layout/paint; the intrinsic size keeps
          // the scrollbar from lurching as they enter and leave. On the wrapper
          // rather than the Card so the design-system primitive stays untouched.
          <div
            key={category.key}
            style={{
              contentVisibility: "auto",
              containIntrinsicSize: `${180 + sections.length * 64}px`,
            }}
          >
          <Card>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-osrs-gold-bright text-lg font-semibold">{category.label}</h2>
              <span className={`text-sm font-medium ${completionTone(category.pct)}`}>
                {category.obtained}/{category.total}
              </span>
            </div>

            <div className="space-y-2">
              {sections.map((section) => {
                const items = missingOnly
                  ? section.items.filter((i) => !i.obtained)
                  : section.items;
                if (items.length === 0) return null;
                return (
                  <div
                    key={section.slug}
                    className="border-osrs-bronze/20 flex flex-wrap items-center gap-x-3 gap-y-2 border-b pb-2 last:border-0"
                  >
                    <div className="flex w-full min-w-0 items-baseline gap-2 sm:w-44">
                      <span className="text-osrs-parchment truncate text-sm font-medium">
                        {section.label}
                      </span>
                      <span className="text-osrs-parchment-dark/60 shrink-0 text-xs">
                        {section.obtained}/{section.total}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                      {items.map((item) => (
                        <span
                          key={item.item_id}
                          onPointerEnter={(e) => openCard(e, item, section.label)}
                          onPointerLeave={closeCard}
                          className={`flex h-8 w-8 items-center justify-center rounded border transition-colors ${
                            item.obtained
                              ? "border-osrs-gold/40 bg-osrs-gold/10 hover:border-osrs-gold"
                              : "border-osrs-bronze/20 bg-osrs-brown-dark/40 opacity-60 hover:opacity-100"
                          }`}
                        >
                          <ItemDbIcon itemId={item.item_id} size={22} gray={!item.obtained} />
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          </div>
        );
      })}

      {hover && (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            left: hover.left,
            top: hover.above ? undefined : hover.top,
            bottom: hover.above ? window.innerHeight - hover.top : undefined,
            width: CARD_WIDTH,
          }}
        >
          <div className="border-osrs-bronze/50 bg-osrs-brown-dark/95 rounded-lg border p-3 shadow-xl backdrop-blur">
            <div className="flex items-center gap-2">
              <ItemDbIcon itemId={hover.item.item_id} size={24} gray={!hover.item.obtained} />
              <div className="min-w-0">
                <div className="text-osrs-parchment truncate text-sm font-medium">
                  {hover.item.name}
                </div>
                <div className="text-osrs-parchment-dark/60 truncate text-xs">
                  {hover.section}
                </div>
              </div>
            </div>
            <div className="border-osrs-bronze/25 mt-2 border-t pt-2 text-xs">
              {hover.item.obtained ? (
                <>
                  <div className="text-osrs-parchment/90">
                    First by{" "}
                    <span className="text-osrs-gold-bright font-medium">
                      {hover.item.by ?? "a member"}
                    </span>
                    {hover.item.shared && (
                      <span className="text-osrs-parchment-dark/70"> and others</span>
                    )}
                  </div>
                  <div className="text-osrs-parchment-dark/70 mt-0.5">
                    {formatObtainedAt(hover.item.at)}
                    {typeof hover.item.count === "number" && hover.item.count > 1
                      ? ` · ${hover.item.count}× total`
                      : ""}
                  </div>
                  {hover.item.source === "clog" && (
                    <div className="text-osrs-parchment-dark/50 mt-0.5">
                      from a collection-log unlock
                    </div>
                  )}
                </>
              ) : (
                <div className="text-osrs-parchment-dark/70">
                  {hover.item.attributable
                    ? "Not seen by DropTracker"
                    : "Not seen — pets are only tracked from the moment a member gets one"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
