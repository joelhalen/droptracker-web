/**
 * Section chrome shared by the group settings page: the card every section
 * sits in (registry-driven or not) and the sub-heading used for groups of
 * fields inside one. Server-safe. The editor uses both; the standalone panels
 * (icon uploader, timeframe board) use the sub-heading so they read as part of
 * the section they are inserted into rather than as a card within a card.
 */
import type { ReactNode } from "react";
import { Card } from "@/components/ui";

export function SettingsSectionShell({
  id,
  label,
  blurb,
  badge,
  children,
}: {
  /** Anchor id (`cfg-…`) the sidebar links to. */
  id: string;
  label: string;
  blurb?: string;
  /** Small chip at the right of the title row (e.g. an unsaved-changes count). */
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card as="section" id={id} padding="p-6" className="scroll-mt-24" aria-labelledby={`${id}-title`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-osrs-gold text-lg font-semibold">
            {label}
          </h2>
          {blurb && <p className="text-osrs-parchment-dark/60 mt-1 text-xs leading-relaxed">{blurb}</p>}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      {children}
    </Card>
  );
}

export function SettingsSubheading({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-osrs-gold-bright/90 text-xs font-semibold tracking-wide uppercase">{children}</h3>
      {hint && <p className="text-osrs-parchment-dark/60 mt-0.5 text-xs">{hint}</p>}
    </div>
  );
}

/** Wraps each block after the first inside a section with a hairline. */
export function SettingsBlock({ first, children }: { first: boolean; children: ReactNode }) {
  return <div className={first ? "" : "border-osrs-bronze/15 mt-6 border-t pt-5"}>{children}</div>;
}
