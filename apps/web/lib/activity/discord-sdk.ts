"use client";

/**
 * Discord Embedded App SDK bootstrap for the /activity surface.
 *
 * The activity is always served through Discord's proxy at
 * https://<client_id>.discordsays.com (root URL mapping →
 * activity.droptracker.io), so the client id is read straight off the
 * hostname — one deployment serves every Discord application that maps to us
 * (unverified webhook-bot app for testing, verified primary app at launch).
 *
 * Outside Discord (no `frame_id` in the query, non-discordsays host) the SDK
 * is never constructed — `getDiscordSdk()` returns null and the page renders
 * an "open this inside Discord" notice instead of hanging on the handshake.
 */
import { DiscordSDK } from "@discord/embedded-app-sdk";

let sdk: DiscordSDK | null = null;

/** Client id parsed from <client_id>.discordsays.com; null anywhere else. */
export function activityClientId(): string | null {
  if (typeof window === "undefined") return null;
  const match = window.location.hostname.match(/^(\d+)\.discordsays\.com$/);
  return match?.[1] ?? null;
}

/** True when running inside Discord's activity iframe. */
export function inDiscordFrame(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("frame_id");
}

/** Singleton SDK instance; null when not inside a Discord activity iframe. */
export function getDiscordSdk(): DiscordSDK | null {
  if (sdk) return sdk;
  const clientId = activityClientId();
  if (clientId == null || !inDiscordFrame()) return null;
  sdk = new DiscordSDK(clientId);
  return sdk;
}

/**
 * Open a URL outside the iframe (Discord shows its leave-app prompt). This is
 * how the activity defers deep features — full lootboards, drop tables,
 * settings, premium — to droptracker.io instead of rebuilding them in-app.
 * Falls back to window.open outside Discord (the /activity "outside" notice).
 */
export async function openExternal(url: string): Promise<void> {
  const s = getDiscordSdk();
  if (!s) {
    window.open(url, "_blank", "noopener");
    return;
  }
  try {
    await s.commands.openExternalLink({ url });
  } catch {
    /* user declined or old client — nothing to do */
  }
}

export type ActivityParticipant = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  nickname?: string | null;
};

/**
 * Live "who's here" — resolves the current participants and invokes `cb` on
 * every change. Returns an unsubscribe. Safe no-op outside Discord or on old
 * clients (commands can throw INVALID_COMMAND).
 */
export function watchParticipants(cb: (list: ActivityParticipant[]) => void): () => void {
  const s = getDiscordSdk();
  if (!s) return () => {};
  const handler = (data: { participants: ActivityParticipant[] }) => cb(data.participants ?? []);
  s.commands
    .getInstanceConnectedParticipants()
    .then((d) => cb((d.participants ?? []) as ActivityParticipant[]))
    .catch(() => {});
  try {
    void s.subscribe("ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE", handler);
  } catch {
    return () => {};
  }
  return () => {
    try {
      void s.unsubscribe("ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE", handler);
    } catch {
      /* already torn down */
    }
  };
}

/** Best-effort rich presence ("Playing DropTracker — <state>"). */
export function setViewActivity(details: string, state?: string): void {
  const s = getDiscordSdk();
  if (!s) return;
  s.commands
    .setActivity({
      activity: {
        type: 0,
        details,
        ...(state ? { state } : {}),
      },
    })
    .catch(() => {});
}
