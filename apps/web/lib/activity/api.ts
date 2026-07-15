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
  GroupProfileSchema,
  LeaderboardPageSchema,
  MeSchema,
  PbBossBoardSchema,
  PbBossIndexSchema,
  PlayerProfileSchema,
  SearchResultsSchema,
  type EventDetail,
  type EventSummary,
  type GroupProfile,
  type LeaderboardPage,
  type Me,
  type PbBossBoard,
  type PbBossIndex,
  type PlayerProfile,
  type SearchResults,
} from "@droptracker/api-types";
import { z } from "zod";

/** Feed history envelope (matches lib/api.ts's local FeedEventSchema). */
const FeedEventSchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});
export type FeedEvent = z.infer<typeof FeedEventSchema>;

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

/**
 * The session user's events across every group they belong to. Powers the
 * guild-less launch context (Activity Links opened from a DM), where there's
 * no guildId to scope by but the user's identity finds their clans anyway.
 */
export async function myEvents(
  status: "active" | "past" | undefined,
  sessionToken: string,
): Promise<EventSummary[]> {
  const q = new URLSearchParams({ mine: "1" });
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

// --- Expanded mini-app reads (all anonymous upstream; icons pre-rewritten to
// --- same-origin /img by the BFF, so payloads are CSP-safe as-is). ----------

export async function leaderboard(
  kind: "players" | "groups",
  period: string,
  scope?: string,
): Promise<LeaderboardPage> {
  const q = new URLSearchParams({ kind, period });
  if (scope) q.set("scope", scope);
  return LeaderboardPageSchema.parse(await get(`/api/activity/leaderboards?${q}`, null));
}

export async function pbBosses(groupId?: number): Promise<PbBossIndex> {
  const q = groupId ? `?groupId=${groupId}` : "";
  return PbBossIndexSchema.parse(await get(`/api/activity/pbs${q}`, null));
}

export async function pbBoard(npcId: number, groupId?: number): Promise<PbBossBoard> {
  const q = new URLSearchParams({ npcId: String(npcId) });
  if (groupId) q.set("groupId", String(groupId));
  return PbBossBoardSchema.parse(await get(`/api/activity/pbs/board?${q}`, null));
}

export async function playerProfile(id: number): Promise<PlayerProfile> {
  return PlayerProfileSchema.parse(await get(`/api/activity/players/${id}`, null));
}

export async function groupProfile(id: number): Promise<GroupProfile> {
  return GroupProfileSchema.parse(await get(`/api/activity/groups/${id}`, null));
}

export async function searchAll(q: string): Promise<SearchResults> {
  return SearchResultsSchema.parse(
    await get(`/api/activity/search?q=${encodeURIComponent(q)}`, null),
  );
}

export async function recentFeed(): Promise<FeedEvent[]> {
  return FeedEventSchema.array().parse(await get("/api/activity/feed", null));
}

const GuildGroupSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  member_count: z.number().int().optional(),
  icon_url: z.string().nullable().optional(),
});
export type GuildGroup = z.infer<typeof GuildGroupSchema>;

const LaunchTargetSchema = z.object({ event_id: z.number().int().nullable() });

/**
 * Deep-link target for this launch: the event the user tapped "Open in Discord"
 * to reach. One-shot claim keyed by their Discord id — returns null when there's
 * nothing pending (they opened the app some other way).
 */
export async function launchIntent(sessionToken: string): Promise<number | null> {
  const data = LaunchTargetSchema.parse(await get("/api/activity/launch-intent", sessionToken));
  return data.event_id;
}

/** Anonymous fallback: the event whose board/notifications live in this channel. */
export async function eventByChannel(channelId: string): Promise<number | null> {
  const data = LaunchTargetSchema.parse(
    await get(`/api/activity/event-by-channel?channelId=${encodeURIComponent(channelId)}`, null),
  );
  return data.event_id;
}

/** The DropTracker group linked to the launch guild; null when unregistered. */
export async function guildGroup(guildId: string): Promise<GuildGroup | null> {
  const res = await fetch(`/api/activity/guild-group?guildId=${encodeURIComponent(guildId)}`, {
    headers: { accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new ActivityApiError(res.status, `guild-group → ${res.status}`);
  return GuildGroupSchema.parse(await res.json());
}
