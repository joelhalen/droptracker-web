"use client";

/**
 * News for the Activity: DropTracker's announcements (the site's
 * `/announcements`) and, when the launch server's clan posts any, the clan's
 * own. A list view, a single-announcement view, and the latest-post card on
 * the home screen.
 *
 * Bodies are Markdown written by staff and clan admins: links open outside
 * Discord through the embed host, and images are mapped to addresses the
 * iframe CSP allows.
 */
import { useEffect, useState } from "react";
import type { Options } from "react-markdown";
import type { Announcement } from "@droptracker/api-types";
import { Markdown } from "@/components/markdown";
import { EmbedImg, ExternalLink } from "@/components/entity-link";
import { Card } from "@/components/ui";
import { truncateMarkdown } from "@/lib/markdown-utils";
import { announcements } from "@/lib/activity/api";
import { useActivityData } from "@/lib/activity/data-context";
import { SITE_ORIGIN } from "@/lib/activity/external-url";
import { useActivityNav } from "@/lib/activity/nav";
import {
  BackBar,
  EmptyNote,
  ErrorNote,
  ExternalButton,
  LoadingBlock,
  SectionHeading,
} from "@/components/activity/bits";

/** Markdown element overrides that keep a body usable inside the iframe. */
const EMBED_MARKDOWN: Options["components"] = {
  a: ({ href, children }) =>
    href ? (
      <ExternalLink href={new URL(href, SITE_ORIGIN).href} className="text-osrs-gold-bright underline">
        {children}
      </ExternalLink>
    ) : (
      <>{children}</>
    ),
  img: ({ src, alt }) =>
    typeof src === "string" && src ? (
      <EmbedImg src={new URL(src, SITE_ORIGIN).href} alt={alt ?? ""} className="max-w-full rounded" />
    ) : null,
};

function postedOn(a: Announcement): string {
  return new Date(a.published_at * 1000).toLocaleDateString();
}

/** Pinned first, then newest. */
function ordered(items: Announcement[]): Announcement[] {
  return [...items].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.published_at - a.published_at,
  );
}

function useAnnouncements(scope: string) {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setFailed(false);
    announcements(scope)
      .then((page) => {
        if (!cancelled) setItems(ordered(page.items));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);
  return { items, failed };
}

export function NewsView({ scope: initialScope, id }: { scope: string; id?: number }) {
  const nav = useActivityNav();
  const { group } = useActivityData();
  const [scope, setScope] = useState(initialScope);
  const { items, failed } = useAnnouncements(scope);
  const clanScope = group ? `group:${group.id}` : null;
  const title = scope === "global" ? "DropTracker news" : `${group?.name ?? "Clan"} news`;

  if (id != null) {
    const item = items?.find((a) => a.id === id);
    return (
      <div>
        <BackBar title={item?.title ?? "Announcement"} onBack={nav.pop} />
        {failed ? (
          <ErrorNote>Couldn&apos;t load this announcement.</ErrorNote>
        ) : !items ? (
          <LoadingBlock rows={4} />
        ) : !item ? (
          <EmptyNote>This announcement is no longer up.</EmptyNote>
        ) : (
          <Card padding="p-4">
            <p className="text-osrs-parchment-dark/55 mb-3 text-[11.5px]">
              {postedOn(item)}
              {item.author_name ? ` · ${item.author_name}` : ""}
            </p>
            {item.cover_image_url && (
              <img src={item.cover_image_url} alt="" className="mb-3 max-h-64 w-full rounded object-cover" />
            )}
            <Markdown components={EMBED_MARKDOWN}>{item.body_md}</Markdown>
          </Card>
        )}
        {scope === "global" && item && (
          <ExternalButton href={`${SITE_ORIGIN}/announcements/${item.id}`}>
            Open on droptracker.io
          </ExternalButton>
        )}
      </div>
    );
  }

  return (
    <div>
      <BackBar title={title} onBack={nav.pop} />
      {clanScope && (
        <div className="mb-3 flex gap-1">
          {[
            { key: "global", label: "DropTracker" },
            { key: clanScope, label: group!.name },
          ].map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setScope(o.key)}
              aria-pressed={scope === o.key}
              className={`max-w-48 truncate rounded-lg px-2.5 py-1 text-[12px] ${
                scope === o.key
                  ? "bg-osrs-bronze text-osrs-parchment font-semibold"
                  : "text-osrs-parchment-dark/70 hover:text-osrs-gold-bright"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {failed ? (
        <ErrorNote>Couldn&apos;t load the news.</ErrorNote>
      ) : !items ? (
        <LoadingBlock rows={4} />
      ) : items.length === 0 ? (
        <EmptyNote>No announcements yet.</EmptyNote>
      ) : (
        <Card padding="p-0">
          {items.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => nav.push({ name: "news", scope, id: a.id })}
              className="border-osrs-bronze/20 hover:bg-osrs-surface-2/60 block w-full border-b px-3.5 py-3 text-left last:border-b-0"
            >
              <span className="flex items-center gap-2">
                {a.pinned && (
                  <span className="border-osrs-gold/50 text-osrs-gold rounded border px-1.5 text-[10px] font-semibold uppercase">
                    Pinned
                  </span>
                )}
                <span className="text-osrs-parchment truncate text-[13.5px] font-semibold">{a.title}</span>
              </span>
              <span className="text-osrs-parchment-dark/55 mt-0.5 block text-[11px]">
                {postedOn(a)}
                {a.author_name ? ` · ${a.author_name}` : ""}
              </span>
              <span className="text-osrs-parchment-dark/75 mt-1.5 line-clamp-3 block text-[12px]">
                {truncateMarkdown(a.body_md, 4).replace(/[#*_`>[\]]/g, "")}
              </span>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}

/** Home-screen card: the newest (or pinned) DropTracker announcement. */
export function HomeNewsCard() {
  const nav = useActivityNav();
  const { items } = useAnnouncements("global");
  const latest = items?.[0];
  if (!latest) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <SectionHeading>News</SectionHeading>
        <button
          type="button"
          onClick={() => nav.push({ name: "news", scope: "global" })}
          className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright shrink-0 text-[12px]"
        >
          All news →
        </button>
      </div>
      <button
        type="button"
        onClick={() => nav.push({ name: "news", scope: "global", id: latest.id })}
        className="border-osrs-bronze/30 bg-osrs-surface-1 hover:border-osrs-bronze/60 block w-full rounded-2xl border px-3.5 py-3 text-left transition-colors"
      >
        <span className="text-osrs-parchment block truncate text-[13.5px] font-semibold">
          {latest.title}
        </span>
        <span className="text-osrs-parchment-dark/55 block text-[11px]">{postedOn(latest)}</span>
        <span className="text-osrs-parchment-dark/75 mt-1 line-clamp-2 block text-[12px]">
          {truncateMarkdown(latest.body_md, 3).replace(/[#*_`>[\]]/g, "")}
        </span>
      </button>
    </div>
  );
}
