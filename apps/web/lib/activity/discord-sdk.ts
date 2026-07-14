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
