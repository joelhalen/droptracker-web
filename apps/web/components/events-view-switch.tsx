"use client";

/**
 * Timeline / List switch for /events. The choice is kept in a cookie the page
 * reads on the server, so a returning visitor gets their view in the first
 * paint with no flash of the other one. A `?view=` link overrides it.
 */
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { EVENTS_VIEW_COOKIE, type EventsView } from "@/lib/event-timeline";

const OPTIONS: { key: EventsView; label: string; icon: React.ReactNode }[] = [
  {
    key: "timeline",
    label: "Timeline",
    icon: (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
        <path d="M3 2v12" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="3" cy="4" r="1.8" fill="currentColor" />
        <circle cx="3" cy="11" r="1.8" fill="currentColor" />
        <path d="M7 4h7M7 11h5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    key: "list",
    label: "List",
    icon: (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
        <rect x="1.5" y="2" width="5.5" height="5" rx="1" fill="currentColor" />
        <rect x="9" y="2" width="5.5" height="5" rx="1" fill="currentColor" />
        <rect x="1.5" y="9" width="5.5" height="5" rx="1" fill="currentColor" />
        <rect x="9" y="9" width="5.5" height="5" rx="1" fill="currentColor" />
      </svg>
    ),
  },
];

export function EventsViewSwitch({ current }: { current: EventsView }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function choose(view: EventsView) {
    if (view === current) return;
    try {
      // Not Secure: the origin is plain HTTP behind Cloudflare (see
      // SESSION_COOKIE_SECURE in DEPLOY.md), a Secure cookie would never stick.
      document.cookie = `${EVENTS_VIEW_COOKIE}=${view}; path=/events; max-age=31536000; SameSite=Lax`;
    } catch {
      // Cookies blocked: the ?view= param below still switches this visit.
    }
    startTransition(() => router.replace(`${pathname}?view=${view}` as Route, { scroll: false }));
  }

  return (
    <div
      role="group"
      aria-label="Events view"
      className={`border-osrs-bronze/40 bg-osrs-surface-1 inline-flex shrink-0 rounded-lg border p-0.5 ${pending ? "opacity-70" : ""}`}
    >
      {OPTIONS.map((o) => {
        const active = o.key === current;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            onClick={() => choose(o.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "bg-osrs-gold text-osrs-brown-dark"
                : "text-osrs-parchment-dark/75 hover:text-osrs-gold-bright"
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
