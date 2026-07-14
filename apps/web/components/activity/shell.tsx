"use client";

/**
 * The activity's chrome once boot/auth resolve: a compact header (brand +
 * live "who's here" presence from the SDK) and the scrolling view area driven
 * by the nav stack. Navigation is responsive to the iframe size — Discord
 * desktop gives the activity a wide window, mobile a narrow one — so the same
 * tabs render as a left sidebar rail on md+ and a safe-area-aware bottom tab
 * bar below that. Also keeps Discord rich presence in sync with the current
 * view.
 */
import { useEffect, useState } from "react";
import {
  setViewActivity,
  watchParticipants,
  type ActivityParticipant,
} from "@/lib/activity/discord-sdk";
import { discordAvatar } from "@/lib/activity/img";
import { useActivityData } from "@/lib/activity/data-context";
import { tabOf, useActivityNav, type ActivityTab, type ActivityView } from "@/lib/activity/nav";
import { HomeView } from "@/components/activity/home-view";
import { RanksView } from "@/components/activity/ranks-view";
import { EventsView } from "@/components/activity/events-view";
import { MeView } from "@/components/activity/me-view";
import { PlayerView } from "@/components/activity/player-view";
import { GroupView } from "@/components/activity/group-view";
import { PbBoardView } from "@/components/activity/pb-board-view";
import { EventView } from "@/components/activity/event-view";

const TABS: { key: ActivityTab; label: string; root: ActivityView; icon: React.ReactNode }[] = [
  {
    key: "home",
    label: "Home",
    root: { name: "home" },
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    key: "ranks",
    label: "Ranks",
    root: { name: "ranks", tab: "players" },
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M6 9V4h12v5a6 6 0 0 1-12 0Z" />
        <path d="M9 20h6M12 15v5" />
      </svg>
    ),
  },
  {
    key: "events",
    label: "Events",
    root: { name: "events" },
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 9h16M9 4v16" />
      </svg>
    ),
  },
  {
    key: "me",
    label: "Me",
    root: { name: "me" },
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
      </svg>
    ),
  },
];

/**
 * Per-view content width. The mini-app was designed thumb-first; lists read
 * best in a column, while the hub/profile views grow into multi-column grids
 * on desktop. Applied to the centered wrapper inside the scroll area.
 */
function viewMaxWidth(view: ActivityView): string {
  switch (view.name) {
    case "home":
    case "me":
      return "max-w-5xl";
    case "player":
    case "group":
      return "max-w-4xl";
    case "event":
      return "max-w-3xl";
    default:
      return "max-w-2xl";
  }
}

function presenceLabel(view: ActivityView): string {
  switch (view.name) {
    case "ranks":
      return view.tab === "pbs" ? "Browsing personal bests" : "Browsing leaderboards";
    case "events":
    case "event":
      return "Watching a clan event";
    case "player":
      return "Viewing a player profile";
    case "group":
      return "Viewing a clan";
    case "pb-board":
      return "Comparing boss times";
    case "me":
      return "Checking their progress";
    default:
      return "Browsing the tracker";
  }
}

function renderView(
  view: ActivityView,
  guildId: string | null,
  onBack: (() => void) | undefined,
) {
  switch (view.name) {
    case "home":
      return <HomeView />;
    case "ranks":
      return <RanksView tab={view.tab} />;
    case "events":
      return <EventsView />;
    case "me":
      return <MeView />;
    case "event":
      return <EventView eventId={view.id} guildId={guildId} onBack={onBack} />;
    case "player":
      return <PlayerView id={view.id} />;
    case "group":
      return <GroupView id={view.id} />;
    case "pb-board":
      return <PbBoardView npcId={view.npcId} bossName={view.bossName} />;
  }
}

export function ActivityShell() {
  const nav = useActivityNav();
  const { guildId } = useActivityData();
  const [participants, setParticipants] = useState<ActivityParticipant[]>([]);

  useEffect(() => watchParticipants(setParticipants), []);
  useEffect(() => {
    setViewActivity("DropTracker", presenceLabel(nav.view));
  }, [nav.view]);

  const shown = participants.slice(0, 4);
  const extra = participants.length - shown.length;

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <header
        className="border-osrs-bronze/25 bg-osrs-surface-1/80 flex shrink-0 items-center gap-2 border-b px-3.5 py-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
      >
        <span className="text-osrs-gold font-serif text-[15px] font-bold tracking-wide">
          DropTracker
        </span>
        <span className="min-w-0 flex-1" />
        {shown.length > 0 && (
          <span className="flex items-center" aria-label={`${participants.length} people here`}>
            {shown.map((p) => (
              <img
                key={p.id}
                src={discordAvatar(p.id, p.avatar, 32)}
                alt={p.global_name ?? p.username}
                title={p.nickname ?? p.global_name ?? p.username}
                className="border-osrs-surface-1 -ml-1.5 size-6 rounded-full border-2 first:ml-0"
              />
            ))}
            {extra > 0 && (
              <span className="text-osrs-parchment-dark/60 ml-1.5 text-[10.5px]">+{extra}</span>
            )}
          </span>
        )}
      </header>

      {/* Sidebar (md+) + view area */}
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Sections"
          className="border-osrs-bronze/25 bg-osrs-surface-1/60 hidden w-48 shrink-0 flex-col gap-1 border-r p-3 md:flex"
        >
          {TABS.map((t) => {
            const active = tabOf(nav.root) === t.key;
            return (
              <button
                key={t.key}
                aria-current={active ? "page" : undefined}
                onClick={() => nav.setRoot(t.root)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                  active
                    ? "bg-osrs-surface-3 text-osrs-gold-bright"
                    : "text-osrs-parchment-dark/60 hover:bg-osrs-surface-2/60 hover:text-osrs-parchment"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </nav>

        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3.5 py-3.5 md:px-6 md:py-5">
          {/* Content hugs the sidebar (left-aligned) rather than centering in
              the wide area — centering left a large gap after the rail. */}
          <div key={JSON.stringify(nav.view)} className={`w-full ${viewMaxWidth(nav.view)}`}>
            {renderView(nav.view, guildId, nav.canPop ? nav.pop : undefined)}
          </div>
        </main>
      </div>

      {/* Bottom tab bar (small screens) */}
      <nav
        aria-label="Sections"
        className="border-osrs-bronze/25 bg-osrs-surface-1/95 grid shrink-0 grid-cols-4 border-t md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map((t) => {
          const active = tabOf(nav.root) === t.key;
          return (
            <button
              key={t.key}
              aria-current={active ? "page" : undefined}
              onClick={() => nav.setRoot(t.root)}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] tracking-wide transition-colors ${
                active ? "text-osrs-gold-bright" : "text-osrs-parchment-dark/50"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
