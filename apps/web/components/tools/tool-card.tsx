"use client";

import { useId, useState } from "react";
import { Card } from "@/components/ui";
import type { ToolListing } from "@/lib/tools-directory";

function Monogram({ tool }: { tool: ToolListing }) {
  if (tool.logo_url) {
    return (
      <img
        src={tool.logo_url}
        alt=""
        referrerPolicy="no-referrer"
        loading="lazy"
        className="border-osrs-bronze/40 size-12 shrink-0 rounded-xl border bg-black/20 object-contain p-1"
      />
    );
  }
  const accent = tool.accent ?? "var(--color-osrs-bronze)";
  return (
    <span
      aria-hidden
      className="font-display flex size-12 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-white shadow-sm"
      style={{
        background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 55%, black))`,
        border: `1px solid color-mix(in srgb, ${accent} 70%, white 10%)`,
      }}
    >
      {tool.name.trim()[0]?.toUpperCase()}
    </span>
  );
}

function hostOf(href: string): string {
  try {
    return new URL(href).host.replace(/^www\./, "");
  } catch {
    return href;
  }
}

export function ToolCard({ tool, onEdit }: { tool: ToolListing; onEdit?: () => void }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const [primary, ...rest] = tool.links;
  const paragraphs = (tool.details ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const hasMore = paragraphs.length > 0 || !!tool.fit_note || tool.tags.length > 0 || rest.length > 0;

  return (
    <Card className={`flex min-w-0 flex-col gap-3 ${tool.visible ? "" : "opacity-70"}`}>
      <div className="flex items-start gap-4">
        <Monogram tool={tool} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-osrs-gold-bright text-lg font-semibold leading-tight">
              {primary ? (
                <a href={primary.href} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {tool.name}
                </a>
              ) : (
                tool.name
              )}
            </h3>
            {!tool.visible && (
              <span className="bg-osrs-red/20 text-osrs-red rounded px-1.5 py-0.5 text-[11px] font-medium">
                Hidden
              </span>
            )}
          </div>
          {primary && (
            <div className="text-osrs-parchment-dark/60 truncate text-xs">{hostOf(primary.href)}</div>
          )}
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright shrink-0 text-sm"
          >
            Edit
          </button>
        )}
      </div>

      {tool.fit_label && (
        <span className="border-osrs-gold/40 bg-osrs-bronze/15 text-osrs-gold w-fit rounded-full border px-2.5 py-0.5 text-xs font-medium">
          {tool.fit_label}
        </span>
      )}

      <p className="text-osrs-parchment-dark/85 text-sm">{tool.summary}</p>

      {open && hasMore && (
        <div id={panelId} className="space-y-3">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-osrs-parchment-dark/80 whitespace-pre-line text-sm">
              {p}
            </p>
          ))}
          {tool.fit_note && (
            <p className="border-osrs-gold/40 bg-osrs-bronze/10 text-osrs-parchment-dark/85 rounded-r border-l-2 px-3 py-2 text-sm">
              <span className="text-osrs-gold font-semibold">With The DropTracker: </span>
              {tool.fit_note}
            </p>
          )}
          {tool.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {tool.tags.map((tag) => (
                <li
                  key={tag}
                  className="border-osrs-bronze/35 text-osrs-parchment-dark/70 rounded-full border px-2 py-0.5 text-[11px]"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
          {rest.length > 0 && (
            <div className="flex flex-wrap gap-3 text-sm">
              {rest.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-osrs-gold-bright hover:underline"
                >
                  {link.label} <span aria-hidden>↗</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1 text-sm">
        {hasMore ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright"
          >
            {open ? "Show less" : "Show more"} <span aria-hidden>{open ? "▴" : "▾"}</span>
          </button>
        ) : (
          <span />
        )}
        {primary && (
          <a
            href={primary.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-osrs-gold-bright hover:underline"
          >
            Visit <span aria-hidden>↗</span>
          </a>
        )}
      </div>
    </Card>
  );
}
