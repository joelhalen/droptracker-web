"use client";

/**
 * Discord Activity entry — the client-side state machine.
 *
 *   boot → authorizing → resolving → event | picker | empty | outside | error
 *
 * Flow: SDK handshake (`ready()`), then OAuth authorize/authenticate (declining
 * degrades to anonymous viewing — public events don't need a session), then
 * resolve the launch guild's active events: exactly one → straight to the
 * board; several → picker; none → empty state pointing at the website.
 */
import { useEffect, useState } from "react";
import type { EventSummary } from "@droptracker/api-types";
import {
  ActivityAuthProvider,
  type ActivityAuth,
} from "@/lib/activity/auth-context";
import { activityClientId, getDiscordSdk, inDiscordFrame } from "@/lib/activity/discord-sdk";
import { exchangeAuthCode, guildEvents } from "@/lib/activity/api";
import { EventView } from "@/components/activity/event-view";

type Stage =
  | { kind: "boot" }
  | { kind: "outside" } // rendered in a plain browser tab, not Discord
  | { kind: "authorizing" }
  | { kind: "resolving" }
  | { kind: "no-guild" } // launched from a DM — no guild context
  | { kind: "empty" }
  | { kind: "picker"; events: EventSummary[] }
  | { kind: "event"; eventId: number }
  | { kind: "error"; message: string };

function Splash({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      {children}
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <Splash>
      <span
        aria-hidden
        className="border-osrs-bronze/40 border-t-osrs-gold size-8 animate-spin rounded-full border-2"
      />
      <p className="text-osrs-parchment-dark/70 text-sm">{label}</p>
    </Splash>
  );
}

export function ActivityApp() {
  const [stage, setStage] = useState<Stage>({ kind: "boot" });
  const [auth, setAuth] = useState<ActivityAuth>({ sessionToken: null, user: null });
  const [guildId, setGuildId] = useState<string | null>(null);
  // Kept so "back" from an event can return to the picker (multi-event guilds).
  const [pickerEvents, setPickerEvents] = useState<EventSummary[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!inDiscordFrame()) {
        setStage({ kind: "outside" });
        return;
      }
      const sdk = getDiscordSdk();
      const clientId = activityClientId();
      if (!sdk || !clientId) {
        setStage({ kind: "outside" });
        return;
      }

      try {
        await sdk.ready();
        if (cancelled) return;

        // --- OAuth: declining consent is fine — continue anonymously. ------
        setStage({ kind: "authorizing" });
        let nextAuth: ActivityAuth = { sessionToken: null, user: null };
        try {
          const { code } = await sdk.commands.authorize({
            client_id: clientId,
            response_type: "code",
            state: "",
            prompt: "none",
            scope: ["identify", "guilds"],
          });
          const result = await exchangeAuthCode(clientId, code);
          await sdk.commands.authenticate({ access_token: result.access_token });
          nextAuth = { sessionToken: result.session_token, user: result.user };
        } catch (err) {
          console.warn("[activity] auth declined/failed — anonymous mode", err);
        }
        if (cancelled) return;
        setAuth(nextAuth);

        // --- Resolve the launch guild's events. -----------------------------
        if (!sdk.guildId) {
          setStage({ kind: "no-guild" });
          return;
        }
        setGuildId(sdk.guildId);
        setStage({ kind: "resolving" });

        const active = await guildEvents(sdk.guildId, "active", nextAuth.sessionToken);
        if (cancelled) return;
        setPickerEvents(active);
        const only = active.length === 1 ? active[0] : undefined;
        if (only) {
          setStage({ kind: "event", eventId: only.id });
        } else if (active.length > 1) {
          setStage({ kind: "picker", events: active });
        } else {
          setStage({ kind: "empty" });
        }
      } catch (err) {
        console.error("[activity] boot failed", err);
        if (!cancelled) {
          setStage({ kind: "error", message: "Couldn't start the activity. Try relaunching it." });
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  switch (stage.kind) {
    case "boot":
      return <Spinner label="Connecting to Discord…" />;
    case "authorizing":
      return <Spinner label="Signing you in…" />;
    case "resolving":
      return <Spinner label="Finding your events…" />;
    case "outside":
      return (
        <Splash>
          <h1 className="text-osrs-gold text-2xl font-bold">DropTracker</h1>
          <p className="text-osrs-parchment-dark/80 max-w-sm text-sm">
            This page is the DropTracker Discord Activity — launch it from a Discord server to see
            your clan&apos;s live event board.
          </p>
          <a href="https://www.droptracker.io/events" className="text-osrs-gold-bright text-sm hover:underline">
            Browse events on the website →
          </a>
        </Splash>
      );
    case "no-guild":
      return (
        <Splash>
          <h1 className="text-osrs-gold text-xl font-bold">Open this in a server</h1>
          <p className="text-osrs-parchment-dark/80 max-w-sm text-sm">
            Events belong to clan servers — launch the activity from your clan&apos;s Discord server
            to see its board.
          </p>
        </Splash>
      );
    case "empty":
      return (
        <Splash>
          <h1 className="text-osrs-gold text-xl font-bold">No active events</h1>
          <p className="text-osrs-parchment-dark/80 max-w-sm text-sm">
            This server doesn&apos;t have a running DropTracker event right now. Group admins can
            set one up at www.droptracker.io.
          </p>
        </Splash>
      );
    case "error":
      return (
        <Splash>
          <h1 className="text-osrs-gold text-xl font-bold">Something went wrong</h1>
          <p className="text-osrs-parchment-dark/80 max-w-sm text-sm">{stage.message}</p>
        </Splash>
      );
    case "picker":
      return (
        <ActivityAuthProvider value={auth}>
          <Splash>
            <h1 className="text-osrs-gold text-xl font-bold">Pick an event</h1>
            <div className="flex w-full max-w-sm flex-col gap-2">
              {stage.events.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => setStage({ kind: "event", eventId: ev.id })}
                  className="border-osrs-bronze/30 bg-osrs-brown-dark/40 hover:border-osrs-bronze/60 rounded border px-4 py-3 text-left"
                >
                  <span className="text-osrs-gold block font-medium">{ev.name}</span>
                  {ev.description && (
                    <span className="text-osrs-parchment-dark/60 mt-0.5 line-clamp-2 block text-xs">
                      {ev.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Splash>
        </ActivityAuthProvider>
      );
    case "event":
      return (
        <ActivityAuthProvider value={auth}>
          <EventView
            eventId={stage.eventId}
            guildId={guildId}
            onBack={
              // Only offer "back" when there was a picker to go back to.
              pickerEvents.length > 1
                ? () => setStage({ kind: "picker", events: pickerEvents })
                : null
            }
          />
        </ActivityAuthProvider>
      );
  }
}
