"use client";

/**
 * The pop-up itself (web118a). The same card renders the live notice
 * (`SiteNotices`), the composer's inline preview and its "Preview pop-up"
 * button, so what staff see while writing is exactly what visitors get.
 *
 * `NoticeDialog` is kept deliberately quiet:
 * - focus moves to the dialog, never to a button, so a stray Enter can't
 *   close a notice nobody read;
 * - Escape, the X, a click outside and "Got it" all close it, and closing is
 *   permanent (the host records it);
 * - Tab stays inside while it's open, and focus goes back where it was after;
 * - the page behind stops scrolling while it's open.
 */
import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";
import type { NoticeSize, NoticeTone, PopupNotice } from "@droptracker/api-types";
import { Markdown } from "@/components/markdown";
import { cn } from "@/components/ui";
import { isExternalHref } from "@/lib/site-notices";

export type NoticeContent = Pick<PopupNotice, "title" | "body_md" | "cta_label" | "cta_url" | "tone" | "size">;

const WIDTH: Record<NoticeSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
};

export const NOTICE_TONE_STYLE: Record<NoticeTone, { bar: string; badge: string; icon: ReactNode; label: string }> = {
  info: {
    bar: "bg-osrs-gold",
    badge: "bg-osrs-gold/15 text-osrs-gold border-osrs-gold/40",
    label: "Notice",
    icon: <path d="M12 8h.01M11 12h1v5h1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  },
  important: {
    bar: "bg-osrs-red",
    badge: "bg-osrs-red/15 text-osrs-red border-osrs-red/40",
    label: "Important",
    icon: <path d="M12 7v6m0 4h.01" strokeWidth="2" strokeLinecap="round" />,
  },
  success: {
    bar: "bg-osrs-green",
    badge: "bg-osrs-green/15 text-osrs-green border-osrs-green/40",
    label: "Good news",
    icon: <path d="m8 12.5 2.5 2.5L16 9.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  },
};

const PANEL =
  "bg-osrs-surface-2 border-osrs-bronze/40 shadow-osrs-pop relative flex w-full flex-col overflow-hidden border";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type CardProps = {
  notice: NoticeContent;
  /** 1-based place in the visitor's queue ("1 of 3"). */
  position?: number;
  total?: number;
  /** Staff preview: badged so it can't be mistaken for a live notice. */
  preview?: boolean;
  /** X, Escape, click outside, "Got it". */
  onClose: () => void;
  /** "Close all", offered while more than one is waiting. */
  onCloseAll?: () => void;
  /** A site link or the button was followed. Omit for plain navigation. */
  onFollowLink?: (href: string, external: boolean) => void;
};

function siteOrigin(): string | undefined {
  return typeof window === "undefined" ? undefined : window.location.origin;
}

/** Header, Markdown body and buttons. Wrapped by `NoticeDialog` (modal) or
 * `NoticeInlinePreview` (static, in the composer). */
function NoticeCardContent({
  notice,
  position = 1,
  total = 1,
  preview = false,
  onClose,
  onCloseAll,
  onFollowLink,
  titleId,
  bodyId,
}: CardProps & { titleId?: string; bodyId?: string }) {
  const tone = NOTICE_TONE_STYLE[notice.tone] ?? NOTICE_TONE_STYLE.info;

  const follow = (e: MouseEvent<HTMLAnchorElement>, href: string, fromButton: boolean) => {
    if (!onFollowLink) return;
    // Modifier clicks keep the browser's own behaviour (new tab/window).
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const external = isExternalHref(href, siteOrigin());
    // Body links to other sites open in a new tab and leave the notice open;
    // the button and site links count as acting on it.
    if (external && !fromButton) return;
    if (!external) e.preventDefault();
    onFollowLink(href, external);
  };

  const cta = notice.cta_label && notice.cta_url ? { label: notice.cta_label, href: notice.cta_url } : null;
  const ctaExternal = cta ? isExternalHref(cta.href, siteOrigin()) : false;

  return (
    <>
      <div className={cn("h-1 w-full shrink-0", tone.bar)} aria-hidden />

      {preview && (
        <div className="bg-osrs-ember/15 text-osrs-ember border-osrs-ember/30 shrink-0 border-b px-4 py-1.5 text-center text-[11px] font-semibold tracking-wide uppercase">
          Preview. Only you can see this.
        </div>
      )}

      <header className="flex shrink-0 items-start gap-3 px-5 pt-4 pb-2">
        <span
          className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border", tone.badge)}
          aria-hidden
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="size-4">
            {tone.icon}
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-osrs-parchment-dark/60 text-[11px] font-semibold tracking-wide uppercase">
            {tone.label}
            {total > 1 && (
              <span className="text-osrs-parchment-dark/50 font-normal normal-case">
                {" "}
                · {position} of {total}
              </span>
            )}
          </p>
          <h2 id={titleId} className="text-osrs-gold text-lg leading-snug font-bold break-words">
            {notice.title || "Untitled notice"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-osrs-parchment-dark/60 hover:text-osrs-parchment hover:bg-osrs-bronze/20 -mt-1 -mr-2 shrink-0 rounded-lg p-2 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="size-4" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div id={bodyId} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
        <Markdown
          className={cn(
            notice.size === "lg" ? "prose-base" : "prose-sm",
            "prose-img:rounded-lg prose-img:my-3 prose-p:my-2 prose-headings:mt-4 prose-headings:mb-2 break-words",
          )}
          components={{
            a: ({ href, children }) => {
              const target = href ?? "";
              const external = isExternalHref(target, siteOrigin());
              return (
                <a
                  href={target}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  onClick={(e) => follow(e, target, false)}
                >
                  {children}
                </a>
              );
            },
          }}
        >
          {notice.body_md || "_Nothing written yet._"}
        </Markdown>
      </div>

      <footer className="border-osrs-bronze/20 flex shrink-0 flex-wrap items-center gap-2 border-t px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {total > 1 && onCloseAll && (
          <button
            type="button"
            onClick={onCloseAll}
            className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright mr-auto text-xs"
          >
            Close all
          </button>
        )}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              cta
                ? "border-osrs-bronze/50 text-osrs-parchment hover:bg-osrs-bronze/30 border"
                : "bg-osrs-gold text-osrs-brown-dark hover:bg-osrs-gold-bright",
            )}
          >
            Got it
          </button>
          {cta && (
            <a
              href={cta.href}
              target={ctaExternal ? "_blank" : undefined}
              rel={ctaExternal ? "noopener noreferrer" : undefined}
              onClick={(e) => follow(e, cta.href, true)}
              className="bg-osrs-gold text-osrs-brown-dark hover:bg-osrs-gold-bright rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            >
              {cta.label}
            </a>
          )}
        </div>
      </footer>
    </>
  );
}

/** The live pop-up: a modal dialog over the page. */
export function NoticeDialog(props: CardProps) {
  const { notice, onClose } = props;
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Focus the dialog (not a button), restore on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, []);

  // Lock page scroll, compensating for the scrollbar so nothing shifts.
  useEffect(() => {
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    const prevPadding = root.style.paddingRight;
    const gutter = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (gutter > 0) root.style.paddingRight = `${gutter}px`;
    return () => {
      root.style.overflow = prevOverflow;
      root.style.paddingRight = prevPadding;
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (nodes.length === 0) {
      e.preventDefault();
      return;
    }
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => {
        // Only a press that starts on the backdrop closes: a text selection
        // dragged out of the panel must not.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          PANEL,
          "rise-in max-h-[88dvh] rounded-t-2xl outline-none sm:max-h-[85vh] sm:rounded-2xl",
          WIDTH[notice.size] ?? WIDTH.md,
        )}
      >
        <NoticeCardContent {...props} titleId={titleId} bodyId={bodyId} />
      </div>
    </div>
  );
}

/** A static copy of the card for the composer: same markup, not interactive. */
export function NoticeInlinePreview({ notice }: { notice: NoticeContent }) {
  return (
    <div className="flex justify-center">
      <div
        inert
        className={cn(PANEL, "max-h-[32rem] rounded-2xl", {
          sm: "max-w-sm",
          md: "max-w-lg",
          lg: "max-w-2xl",
        }[notice.size] ?? "max-w-lg")}
      >
        <NoticeCardContent notice={notice} onClose={() => {}} />
      </div>
    </div>
  );
}
