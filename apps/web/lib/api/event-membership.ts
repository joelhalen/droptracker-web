import { z } from "zod";
import { apiGet, apiSend, withFallback } from "./_client";
import {
  EventInvitationSchema,
  EventParticipantSchema,
  EventRecruitingItemSchema,
  EventSignupSchema,
  EventJoinResultSchema,
  EventRandomizeResultSchema,
  EventPopulateResultSchema,
  type EventSignup,
  type EventJoinResult,
  type EventRandomizeResult,
  type EventPopulateResult,
  type EventInvitation,
  type EventJoinInput,
  type EventParticipant,
  type EventRecruitingItem,
  EventTeamBulkAddResultSchema,
  type EventTeamBulkAddResult,
} from "@droptracker/api-types";
import {
  mockEventParticipants,
  mockEventSignups,
} from "../mock-data";

export const eventMembershipApi = {

  // --- Event membership (Task 16) ------------------------------------------
  async joinEvent(eventId: number, input: EventJoinInput): Promise<EventJoinResult> {
    return withFallback(
      async () => EventJoinResultSchema.parse(await apiSend("POST", `/events/${eventId}/join`, input)),
      () => ({ team_id: input.team_id ?? 21, pooled: false }),
    );
  },


  async leaveEvent(eventId: number, playerId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/leave`, { player_id: playerId });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  async addEventTeamMember(
    eventId: number,
    teamId: number,
    playerId: number,
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/teams/${teamId}/members`, {
          player_id: playerId,
        });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  /** Bulk roster add from a pasted list of RSNs; returns per-name outcomes. */
  async bulkAddEventTeamMembers(
    eventId: number,
    teamId: number,
    names: string[],
  ): Promise<EventTeamBulkAddResult> {
    return withFallback(
      async () =>
        EventTeamBulkAddResultSchema.parse(
          await apiSend("POST", `/events/${eventId}/teams/${teamId}/members/bulk`, { names }),
        ),
      () => ({
        added: names.map((name, i) => ({ id: 9000 + i, name })),
        skipped: [],
      }),
    );
  },


  async removeEventTeamMember(
    eventId: number,
    teamId: number,
    playerId: number,
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/events/${eventId}/teams/${teamId}/members/${playerId}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  // --- Clan-vs-clan participants (Plan B) ------------------------------------
  async eventParticipants(eventId: number): Promise<EventParticipant[]> {
    return withFallback(
      async () =>
        EventParticipantSchema.array().parse(
          await apiGet(`/events/${eventId}/participants`, { authed: true }),
        ),
      () => mockEventParticipants(),
    );
  },


  async inviteEventParticipant(eventId: number, groupId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/participants`, { group_id: groupId });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  /** Invite several opponent clans at once (the many-clan case). Returns the
   * per-clan outcome so the UI can report exactly who was invited vs skipped. */
  async bulkInviteEventParticipants(
    eventId: number,
    groupIds: number[],
  ): Promise<{
    invited: { group_id: number; group_name: string | null }[];
    skipped: { group_id: number; group_name: string | null; reason: string }[];
  }> {
    const clan = z.object({ group_id: z.number(), group_name: z.string().nullable() });
    const schema = z.object({
      invited: clan.array(),
      skipped: clan.extend({ reason: z.string() }).array(),
    });
    return withFallback(
      async () =>
        schema.parse(
          await apiSend("POST", `/events/${eventId}/participants/bulk`, {
            group_ids: groupIds,
          }),
        ),
      () => ({ invited: [], skipped: [] }),
    );
  },


  async acceptEventInvitation(
    eventId: number,
    groupId: number,
    opts?: { createDiscordEvent?: boolean },
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/participants/${groupId}/accept`, {
          create_discord_event: Boolean(opts?.createDiscordEvent),
        });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  async declineEventInvitation(eventId: number, groupId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/participants/${groupId}/decline`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  async removeEventParticipant(eventId: number, groupId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/events/${eventId}/participants/${groupId}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  /** Pending invites for clans the caller administers. */
  async eventInvitations(): Promise<EventInvitation[]> {
    return withFallback(
      async () =>
        EventInvitationSchema.array().parse(await apiGet(`/events/invitations`, { authed: true })),
      () => [],
    );
  },


  /** Clan-vs-clan events open to member opt-in that the caller hasn't joined. */
  async eventRecruiting(): Promise<EventRecruitingItem[]> {
    return withFallback(
      async () =>
        EventRecruitingItemSchema.array().parse(
          await apiGet(`/events/recruiting`, { authed: true }),
        ),
      () => [],
    );
  },


  // --- Sign-up pool (formation_mode === "signup_pool") ---------------------
  /** The event's sign-up pool, with each player's current placement (admin). */
  async eventSignups(eventId: number): Promise<EventSignup[]> {
    return withFallback(
      async () =>
        EventSignupSchema.array().parse(
          await apiGet(`/events/${eventId}/signups`, { authed: true }),
        ),
      () => mockEventSignups(),
    );
  },


  /** Place one signed-up player onto a team (admin manual sort). */
  async assignEventSignup(eventId: number, playerId: number, teamId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/signups/assign`, {
          player_id: playerId,
          team_id: teamId,
        });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  /** Move a signed-up player back to the pool (drop their team placement but
   * keep the sign-up) — undo a mis-assignment without withdrawing them. */
  async unassignEventSignup(eventId: number, playerId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/signups/unassign`, {
          player_id: playerId,
        });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  /** Randomly (re)distribute the pool across teams; optional clan scope. */
  async randomizeEventSignups(
    eventId: number,
    groupId?: number,
  ): Promise<EventRandomizeResult> {
    return withFallback(
      async () =>
        EventRandomizeResultSchema.parse(
          await apiSend(
            "POST",
            `/events/${eventId}/signups/randomize`,
            groupId != null ? { group_id: groupId } : {},
          ),
        ),
      () => ({ assigned: 0, unassigned: 0 }),
    );
  },


  /** Admin scale/testing tool: bulk-fill teams with random active members. */
  async populateEventRandom(
    eventId: number,
    source: "group" | "global",
    count?: number,
  ): Promise<EventPopulateResult> {
    return withFallback(
      async () =>
        EventPopulateResultSchema.parse(
          await apiSend("POST", `/events/${eventId}/populate-random`, {
            source,
            ...(count != null ? { count } : {}),
          }),
        ),
      () => ({ added: 0, source, teams: [] }),
    );
  },


  /** Withdraw a player from the pool (admin). */
  async removeEventSignup(eventId: number, playerId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/events/${eventId}/signups/${playerId}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  /** Post an interactive "Sign up" button to the event's Discord channel. */
  async postEventSignupMessage(eventId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/signup-message`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },
};
