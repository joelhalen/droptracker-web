/**
 * Blocks that work on every page kind (web137a): text, image, buttons,
 * divider, plus the link-row styling the clan and profile link blocks share.
 */
import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import type { Align, LinkStyle, PageBlock } from "@droptracker/api-types";
import { Markdown } from "@/components/markdown";

const ALIGN_CLASS: Record<Align, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};
const TEXT_ALIGN: Record<Align, string> = { left: "text-left", center: "text-center", right: "text-right" };

export function linkClass(style: LinkStyle): string {
  switch (style) {
    case "osrs":
      return "pl-btn-osrs";
    case "solid":
      return "bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark inline-flex items-center gap-1.5 rounded px-3.5 py-1.5 text-sm font-medium text-osrs-parchment transition-colors";
    default:
      return "border-osrs-bronze/50 hover:bg-osrs-bronze/30 inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm font-medium transition-colors";
  }
}

export type LinkItem = { key: string; label: string; href: string; external?: boolean; accent?: boolean; badge?: ReactNode };

export function LinkRow({ items, style, align }: { items: LinkItem[]; style: LinkStyle; align: Align }) {
  if (items.length === 0) return null;
  return (
    <nav className={`flex flex-wrap gap-2 ${ALIGN_CLASS[align]}`}>
      {items.map((item) => {
        // The Discord invite keeps its call-to-action look in the outline style.
        const cls = item.accent && style === "outline" ? linkClass("solid") : linkClass(style);
        return item.external ? (
          <a key={item.key} href={item.href} rel="noopener noreferrer" className={cls}>
            {item.label}
            {item.badge}
          </a>
        ) : (
          <Link key={item.key} href={item.href as Route} className={cls}>
            {item.label}
            {item.badge}
          </Link>
        );
      })}
    </nav>
  );
}

const IMAGE_HEIGHT = { sm: "max-h-48", md: "max-h-80", lg: "max-h-[36rem]", auto: "" } as const;

/** Returns null when the block has nothing to show (the caller drops it). */
export function renderSharedBlock(block: PageBlock, opts: { light: boolean }): ReactNode | undefined {
  switch (block.type) {
    case "markdown":
      if (!block.body.trim()) return null;
      return (
        <div className={`${TEXT_ALIGN[block.align]} ${block.align === "center" ? "mx-auto" : ""} max-w-3xl`}>
          <Markdown tone={opts.light ? "ink" : "default"}>{block.body}</Markdown>
        </div>
      );
    case "image": {
      if (!block.url) return null;
      const img = (
        // Plain <img>: uploaded GIFs stay animated (repo-wide convention).
        <img
          src={block.url}
          alt={block.alt}
          loading="lazy"
          className={`border-osrs-bronze/30 w-full rounded-xl border ${IMAGE_HEIGHT[block.height]} ${
            block.fit === "contain" ? "object-contain" : "object-cover"
          }`}
        />
      );
      return (
        <figure>
          {block.link ? (
            <a href={block.link} rel="noopener noreferrer">
              {img}
            </a>
          ) : (
            img
          )}
          {block.caption && (
            <figcaption className="text-osrs-parchment-dark/70 mt-2 text-center text-sm">{block.caption}</figcaption>
          )}
        </figure>
      );
    }
    case "buttons": {
      const items = block.items
        .filter((i) => i.label.trim() && i.href.trim())
        .map((i, n) => ({ key: String(n), label: i.label, href: i.href, external: !i.href.startsWith("/") }));
      if (items.length === 0) return null;
      return <LinkRow items={items} style={block.style} align={block.align} />;
    }
    case "divider":
      return (
        <div className={{ sm: "py-1", md: "py-3", lg: "py-8" }[block.size]}>
          {block.rule && <hr className="border-osrs-bronze/30" />}
        </div>
      );
    default:
      return undefined; // not a shared block
  }
}
