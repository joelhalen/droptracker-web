"use client";

/**
 * Small "?" affordance for concise, in-place help — the events wizard's
 * answer to "explain every setting without a wall of text". Hover/tap opens
 * a portal HoverCard with a one-or-two-sentence explanation and an optional
 * "Learn more" link into the docs CMS.
 */
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { HoverCard } from "@/components/hover-card";

export function HelpTip({
  title,
  children,
  docsHref,
}: {
  /** Bold first line of the card (usually the field's name). */
  title?: string;
  /** The explanation — keep it to a sentence or two. */
  children: ReactNode;
  /** Optional docs page for the full story, e.g. "/docs/events-teams". */
  docsHref?: string;
}) {
  return (
    <HoverCard
      width={260}
      content={
        <div className="p-2.5 text-xs">
          {title && <p className="text-osrs-gold-bright mb-1 font-semibold">{title}</p>}
          <div className="text-osrs-parchment/85 space-y-1">{children}</div>
          {docsHref && (
            <Link
              href={docsHref as Route}
              className="text-osrs-gold hover:text-osrs-gold-bright mt-1.5 inline-block font-medium"
            >
              Learn more →
            </Link>
          )}
        </div>
      }
    >
      <span
        aria-label={title ? `About ${title}` : "More information"}
        className="border-osrs-bronze/50 text-osrs-parchment-dark/70 hover:border-osrs-gold hover:text-osrs-gold-bright ml-1.5 inline-flex size-4 cursor-help items-center justify-center rounded-full border text-[10px] font-semibold leading-none align-middle"
      >
        ?
      </span>
    </HoverCard>
  );
}
