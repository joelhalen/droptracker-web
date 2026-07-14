"use client";

/**
 * Discord Activity entry — boot state machine.
 *
 *   boot → outside | authorizing → ready | error
 *
 * Flow: SDK handshake (`ready()`), then OAuth authorize/authenticate (declining
 * degrades to anonymous viewing — public data doesn't need a session), then a
 * best-effort resolve of the launch guild's registered group. Everything after
 * that is the multi-view mini-app: <ActivityShell/> with the view-stack nav
 * (home hub, leaderboards, events, profiles, me). Launching from a DM (no
 * guild) still works — global content only.
 */
import { useEffect, useState } from "react";
import {
  ActivityAuthProvider,
  type ActivityAuth,
} from "@/lib/activity/auth-context";
import { ActivityDataProvider, type ActivityData } from "@/lib/activity/data-context";
import { ActivityNavProvider } from "@/lib/activity/nav";
import { activityClientId, getDiscordSdk, inDiscordFrame } from "@/lib/activity/discord-sdk";
import { exchangeAuthCode, guildGroup } from "@/lib/activity/api";
import { ActivityShell } from "@/components/activity/shell";

type Stage =
  | { kind: "boot" }
  | { kind: "outside" } // rendered in a plain browser tab, not Discord
  | { kind: "authorizing" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

function Splash({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
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
  const [data, setData] = useState<ActivityData>({ guildId: null, group: null });

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

        // --- Launch context: resolve the guild's registered group. ---------
        const guildId = sdk.guildId ?? null;
        let group = null;
        if (guildId) {
          group = await guildGroup(guildId).catch(() => null);
        }
        if (cancelled) return;
        setData({ guildId, group });
        setStage({ kind: "ready" });
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
    case "outside":
      return (
        <Splash>
          <h1 className="text-osrs-gold font-serif text-2xl font-bold">DropTracker</h1>
          <p className="text-osrs-parchment-dark/80 max-w-sm text-sm">
            This page is the DropTracker Discord Activity — launch it from a Discord server to see
            your clan&apos;s live boards, leaderboards, and profiles.
          </p>
          <a
            href="https://www.droptracker.io"
            className="text-osrs-gold-bright text-sm hover:underline"
          >
            Browse DropTracker on the website →
          </a>
        </Splash>
      );
    case "error":
      return (
        <Splash>
          <h1 className="text-osrs-gold font-serif text-xl font-bold">Something went wrong</h1>
          <p className="text-osrs-parchment-dark/80 max-w-sm text-sm">{stage.message}</p>
        </Splash>
      );
    case "ready":
      return (
        <ActivityAuthProvider value={auth}>
          <ActivityDataProvider value={data}>
            <ActivityNavProvider>
              <ActivityShell />
            </ActivityNavProvider>
          </ActivityDataProvider>
        </ActivityAuthProvider>
      );
  }
}
