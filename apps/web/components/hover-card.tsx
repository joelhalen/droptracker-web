"use client";

/**
 * Portal-based hover card: rich popover anchored to an inline trigger.
 *
 * Why a portal: listing rows live inside `overflow-x-auto` table wrappers
 * (the mobile-overflow fix), which would clip an absolutely-positioned
 * popover. The card renders into document.body with fixed coordinates
 * measured from the trigger instead.
 *
 * Interaction:
 *  - Desktop: opens on hover (short delay), stays open while the pointer is
 *    over the trigger or the card, closes shortly after leaving both.
 *  - Touch: tapping the trigger toggles the card — except taps on links
 *    inside the trigger (e.g. the player-name link), which navigate as usual.
 *  - Escape, scrolling, or resizing closes it.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Divider + spacing used between sections inside hover-card bodies. */
export const CARD_SECTION_CLASS = "border-osrs-bronze/25 mt-2.5 border-t pt-2.5";

/** One label/value stat row inside a hover-card body. */
export function CardStatLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-osrs-parchment-dark/60">{label}</span>
      <span className="text-osrs-parchment/90 truncate font-medium">{value}</span>
    </div>
  );
}

const OPEN_DELAY_MS = 150;
const CLOSE_DELAY_MS = 200;
const CARD_WIDTH = 288; // w-72
const EDGE_GAP = 8;
const ANCHOR_GAP = 6;
/** Rough flip threshold: place the card above when this little room remains. */
const MIN_SPACE_BELOW = 280;

type Pos = { left: number; top?: number; bottom?: number };

export function HoverCard({
  content,
  children,
  className = "",
  style,
  width = CARD_WIDTH,
}: {
  /** Card body; rendered inside a `card-pop` container. */
  content: ReactNode;
  /** Inline trigger contents. */
  children: ReactNode;
  className?: string;
  /** Inline style for the trigger anchor — lets absolutely-positioned triggers
   * (e.g. board tiles laid out on a background image) carry their own
   * left/top/size without a wrapping element. */
  style?: React.CSSProperties;
  /** Card width in px; wider cards (e.g. the task detail card) opt up from the
   * default. Also used for the horizontal edge clamp. */
  width?: number;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = closeTimer.current = null;
  };

  const openNow = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(
      Math.max(rect.left, EDGE_GAP),
      Math.max(EDGE_GAP, window.innerWidth - width - EDGE_GAP),
    );
    if (window.innerHeight - rect.bottom < MIN_SPACE_BELOW) {
      setPos({ left, bottom: window.innerHeight - rect.top + ANCHOR_GAP });
    } else {
      setPos({ left, top: rect.bottom + ANCHOR_GAP });
    }
  }, []);

  const scheduleOpen = () => {
    clearTimers();
    openTimer.current = setTimeout(openNow, OPEN_DELAY_MS);
  };
  const scheduleClose = () => {
    clearTimers();
    closeTimer.current = setTimeout(() => setPos(null), CLOSE_DELAY_MS);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // Scrolling the page closes the card, but scrolling INSIDE it (a tall,
    // internally-scrollable body like the task detail card) must not.
    const onScroll = (e: Event) => {
      const t = e.target as Node | null;
      if (t && cardRef.current?.contains(t)) return;
      setPos(null);
    };
    // capture: the scrolling element may be a nested overflow container.
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [pos]);

  useEffect(() => clearTimers, []);

  const onTriggerClick = (e: React.MouseEvent) => {
    // Links inside the trigger keep their normal behavior (navigate).
    if ((e.target as HTMLElement).closest("a")) return;
    e.preventDefault();
    clearTimers();
    if (pos) setPos(null);
    else openNow();
  };

  return (
    <>
      <span
        ref={anchorRef}
        className={className}
        style={style}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onClick={onTriggerClick}
      >
        {children}
      </span>
      {pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={cardRef}
            role="tooltip"
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              bottom: pos.bottom,
              width,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            className="card-pop menu-in z-[70]"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
