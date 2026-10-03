"use client";

/**
 * The team's event lootboard on its team page: the same PNG the bot posts in
 * the team's Discord channel (disc `lootboard/team_boards.py`, t63), covering
 * every tracked drop from the roster over the event's own window.
 *
 * The image is loaded from the relative `/img/...` path rather than the
 * absolute www URL the API hands out: nginx serves `/img` on www, and inside
 * the Discord Activity a relative path is the only one the discordsays CSP
 * lets through. "Open full size" keeps the absolute URL (the Activity's
 * `openLink` needs one).
 */
import { useState, type ReactNode } from "react";
import type { EventTeamDetail } from "@droptracker/api-types";
import { formatRelativeTime } from "@/lib/format";

type Board = NonNullable<EventTeamDetail["team"]["lootboard"]>;

/** Natural size of every lootboard theme; reserves the box before load. */
const BOARD_ASPECT = "1074 / 795";

/** `https://www.droptracker.io/img/x.png?v=1` → `/img/x.png?v=1`. */
function sameOriginImg(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.startsWith("/img/") ? `${u.pathname}${u.search}` : url;
  } catch {
    return url;
  }
}

export function EventTeamLootboard({
  board,
  teamName,
  status,
  isPublic,
  readOnly = false,
  openLink,
}: {
  board: Board | null | undefined;
  teamName: string;
  status: EventTeamDetail["event"]["status"];
  isPublic: boolean;
  readOnly?: boolean;
  openLink?: (url: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  // No board yet: only worth a word while a public event is running, which
  // is the one case where one is about to appear. Private events never get
  // a board (their image URL would be public), so say nothing there.
  if (!board) {
    if (status !== "active" || !isPublic) return null;
    return (
      <Shell>
        <p className="border-osrs-bronze/25 text-osrs-parchment-dark/60 rounded-lg border border-dashed px-4 py-6 text-center text-sm">
          The team lootboard is drawn within an hour of the event going live.
        </p>
      </Shell>
    );
  }
  if (failed) return null;

  const fullUrl = board.url;
  const fullSizeTitle = `Open the ${teamName} lootboard full size`;

  const image = (
    <span
      className="bg-osrs-surface-2/40 relative block w-full overflow-hidden"
      style={{ aspectRatio: BOARD_ASPECT }}
    >
      {!loaded && <span className="bg-osrs-surface-2/60 absolute inset-0 animate-pulse" />}
      <img
        src={sameOriginImg(board.url)}
        alt={`${teamName} lootboard`}
        width={1074}
        height={795}
        loading="lazy"
        decoding="async"
        // SSR: the browser can finish (or fail) the image before hydration
        // attaches onLoad/onError, which would leave it hidden forever, so
        // also read the outcome straight off the element when it mounts.
        ref={(el) => {
          if (!el?.complete) return;
          if (el.naturalWidth > 0) setLoaded(true);
          else setFailed(true);
        }}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`block h-full w-full object-contain transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
      <span className="pointer-events-none absolute right-2 bottom-2 rounded-md bg-black/70 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        View full size ↗
      </span>
    </span>
  );

  const frameClass =
    "group border-osrs-bronze/25 hover:border-osrs-gold/50 focus-visible:border-osrs-gold block w-full overflow-hidden rounded-lg border transition-colors focus-visible:outline-none";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl.split("?")[0] ?? fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the full-size link still works */
    }
  };

  return (
    <Shell
      updatedAt={board.updated_at}
      note={
        status === "past"
          ? `Every tracked drop from ${teamName} during the event, from all sources.`
          : `Every tracked drop from ${teamName} since the event went live, from all sources. Redrawn hourly.`
      }
    >
      <div className="max-w-4xl">
        {openLink ? (
          <button
            type="button"
            onClick={() => openLink(fullUrl)}
            className={frameClass}
            title={fullSizeTitle}
          >
            {image}
          </button>
        ) : (
          <a
            href={fullUrl}
            target="_blank"
            rel="noreferrer"
            className={frameClass}
            title={fullSizeTitle}
          >
            {image}
          </a>
        )}
        {!readOnly && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <a
              href={fullUrl}
              target="_blank"
              rel="noreferrer"
              className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright"
            >
              Open full size ↗
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright"
            >
              {copied ? "Link copied" : "Copy image link"}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({
  children,
  updatedAt,
  note,
}: {
  children: ReactNode;
  updatedAt?: number;
  note?: string;
}) {
  return (
    <section className="min-w-0">
      <h2 className="heading-rule text-osrs-gold mb-3 flex flex-wrap items-baseline justify-between gap-x-3 pb-1 text-lg font-semibold">
        Team lootboard
        {updatedAt != null && (
          <span
            className="text-osrs-parchment-dark/50 text-xs font-normal"
            title={new Date(updatedAt * 1000).toLocaleString()}
          >
            Updated {formatRelativeTime(updatedAt)}
          </span>
        )}
      </h2>
      {note && <p className="text-osrs-parchment-dark/60 mb-3 text-sm">{note}</p>}
      {children}
    </section>
  );
}
