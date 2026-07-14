"use client";

/**
 * Client-side fetcher for the Discord Activity.
 *
 * Only ever talks to the same-origin /api/activity/* BFF routes (rule #1:
 * browser → BFF only) — same-origin is also what keeps every request inside
 * the activity's CSP, which blocks all non-mapped hosts. Responses are
 * Zod-parsed with the shared api-types schemas so the activity gets the same
 * contract guarantees as the rest of the site.
 */
import {
  EventDetailSchema,
  EventSummarySchema,
  MeSchema,
  type EventDetail,
  type EventSummary,
  type Me,
} from "@droptracker/api-types";

export class ActivityApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function get(path: string, sessionToken: string | null): Promise<unknown> {
  const res = await fetch(path, {
    headers: {
      accept: "application/json",
      ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
    },
  });
  if (!res.ok) throw new ActivityApiError(res.status, `GET ${path} → ${res.status}`);
  return res.json();
}

export type ActivityAuthResult = {
  access_token: string;
  session_token: string | null;
  user: {
    id: string;
    username: string;
    global_name: string | null;
    avatar: string | null;
  };
};

/** Exchange the SDK's OAuth code for a Discord access token + our session. */
export async function exchangeAuthCode(
  clientId: string,
  code: string,
): Promise<ActivityAuthResult> {
  const res = await fetch("/api/activity/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: clientId, code }),
  });
  if (!res.ok) throw new ActivityApiError(res.status, `auth exchange → ${res.status}`);
  return (await res.json()) as ActivityAuthResult;
}

/** Active (or otherwise) events for the guild the activity was launched in. */
export async function guildEvents(
  guildId: string,
  status: "active" | "past" | undefined,
  sessionToken: string | null,
): Promise<EventSummary[]> {
  const q = new URLSearchParams({ guildId });
  if (status) q.set("status", status);
  return EventSummarySchema.array().parse(
    await get(`/api/activity/events?${q.toString()}`, sessionToken),
  );
}

/** Full event detail; includes the viewer block when a session is presented. */
export async function eventDetail(
  eventId: number,
  sessionToken: string | null,
): Promise<EventDetail> {
  return EventDetailSchema.parse(await get(`/api/activity/events/${eventId}`, sessionToken));
}

/** Signed-in profile (linked players + groups) — powers the join panel. */
export async function activityMe(sessionToken: string): Promise<Me> {
  return MeSchema.parse(await get("/api/activity/me", sessionToken));
}

async function send(path: string, sessionToken: string, body: unknown): Promise<unknown> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Surface the upstream RFC-7807 detail so the join panel shows the real
    // reason ("wrong join code", "team is full", …) instead of a generic one.
    const detail = await res
      .json()
      .then((b: { detail?: string }) => b?.detail)
      .catch(() => undefined);
    throw new ActivityApiError(res.status, detail ?? `Request failed (${res.status}).`);
  }
  return res.json().catch(() => ({}));
}

export async function joinEvent(
  eventId: number,
  input: { player_id: number; team_id?: number; join_code?: string },
  sessionToken: string,
): Promise<unknown> {
  return send(`/api/activity/events/${eventId}/join`, sessionToken, input);
}

export async function leaveEvent(
  eventId: number,
  playerId: number,
  sessionToken: string,
): Promise<unknown> {
  return send(`/api/activity/events/${eventId}/leave`, sessionToken, { player_id: playerId });
}
