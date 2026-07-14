"use client";

/**
 * Reusable expand/collapse section with the design-system section header
 * (`heading-rule text-osrs-gold` — same look as the static `<h3>` headers in
 * event-manager.tsx et al.), a chevron that rotates when open, and optional
 * hint text / summary badge on the header row. Keyboard accessible: the whole
 * header is a real `<button>` with `aria-expanded`/`aria-controls`.
 */
import { useId, useState, type ReactNode } from "react";

export function CollapsibleSection({
  title,
  hint,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  /** Small muted line under the title, shown whether open or closed. */
  hint?: string;
  defaultOpen?: boolean;
  /** Small chip/summary rendered at the right edge of the header row. */
  badge?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        className="heading-rule group flex w-full items-center justify-between gap-3 pb-1 text-left"
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className={`text-osrs-bronze group-hover:text-osrs-gold-bright text-sm transition-transform ${
              open ? "rotate-90" : ""
            }`}
          >
            ▶
          </span>
          <span className="text-osrs-gold text-lg font-semibold">{title}</span>
        </span>
        {badge && <span className="shrink-0">{badge}</span>}
      </button>
      {hint && <p className="text-osrs-parchment-dark/60 mt-1 text-sm">{hint}</p>}
      {open && (
        <div id={contentId} className="mt-3">
          {children}
        </div>
      )}
    </section>
  );
}
