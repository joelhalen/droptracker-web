"use client";

/**
 * Header search: replaces the old "Search" nav tab (which only linked to the
 * /search page) with the live typeahead field, opened in place from the
 * header's right-hand controls beside the theme menu.
 *
 * Collapsed it is a small trigger, so it costs the crowded nav row almost no
 * width. Opened, the field floats over the row (desktop: expands leftwards
 * over the nav; mobile: drops below the header like the mobile menu) instead
 * of pushing the tabs around. `/` or Ctrl/Cmd+K opens it from anywhere; Enter
 * with nothing highlighted still goes to the full /search results page.
 */
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { EntitySearch } from "@/components/entity-search";

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function SearchGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M12.8 12.8L17 17" strokeLinecap="round" />
    </svg>
  );
}

export function HeaderSearch({
  variant,
  onOpen,
}: {
  variant: "desktop" | "mobile";
  /** Fired when the field opens — the header closes its mobile menu. */
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Close after navigating (a picked result, or any other link).
  useEffect(() => setOpen(false), [pathname]);

  // Keyboard shortcut. Both variants mount (CSS hides one), so only the
  // visible one answers — `offsetParent` is null under `display: none`.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!triggerRef.current?.offsetParent) return;
      const slash = e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !isEditable(e.target);
      const cmdK = e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey);
      if (slash || cmdK) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Clicking anywhere outside the field closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const field = (
    <EntitySearch
      size="sm"
      autoFocus
      placeholder="Search players, clans, bosses, items…"
      onEscape={close}
      onNavigate={() => setOpen(false)}
    />
  );

  if (variant === "mobile") {
    return (
      // Not `relative`: the panel anchors to the header, full width like the menu.
      <div ref={rootRef}>
        <button
          ref={triggerRef}
          type="button"
          aria-label="Search"
          aria-expanded={open}
          onClick={() => {
            if (!open) onOpen?.();
            setOpen(!open);
          }}
          className={`hover:bg-osrs-bronze/30 flex size-9 cursor-pointer items-center justify-center rounded-lg transition-colors ${
            open ? "bg-osrs-bronze/25 text-osrs-gold-bright" : ""
          }`}
        >
          <SearchGlyph className="size-5" />
        </button>
        {open && (
          <div className="card-pop menu-in absolute inset-x-3 top-full z-50 mt-1 p-2">{field}</div>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      {/* Trigger stays mounted (invisible while open) so the row keeps its width. */}
      <button
        ref={triggerRef}
        type="button"
        aria-label="Search"
        aria-keyshortcuts="/ Control+K Meta+K"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={`border-osrs-bronze/40 text-osrs-parchment-dark/70 hover:border-osrs-gold/60 hover:text-osrs-parchment flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-2 text-sm transition-colors xl:w-44 xl:px-2.5 ${
          open ? "invisible" : ""
        }`}
      >
        <SearchGlyph className="size-4 shrink-0" />
        <span className="hidden flex-1 text-left xl:inline">Search</span>
        <kbd className="border-osrs-bronze/40 text-osrs-parchment-dark/60 hidden rounded border px-1.5 font-sans text-[10px] leading-4 xl:inline">
          /
        </kbd>
      </button>
      {open && (
        <div className="bg-osrs-surface-2 absolute top-1/2 right-0 z-50 w-80 -translate-y-1/2 rounded-lg">
          {field}
        </div>
      )}
    </div>
  );
}
