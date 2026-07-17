"use server";

import { revalidatePath } from "next/cache";
import { EventJoinInputSchema, EventMemberInputSchema } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

/** Player-facing join (Task 16). Ownership, eligibility, formation-mode and
 * join-code rules are enforced server-side by the Web API; this action only
 * requires a session and forwards the request. */
export async function joinEvent(
  eventId: number,
  input: { player_id: number; team_id?: number; join_code?: string },
) {
  const user = await getUser();
  if (!user) throw new Error("Sign in to join an event.");
  const parsed = EventJoinInputSchema.parse(input);
  const result = await api.joinEvent(eventId, parsed);
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const, team_id: result.team_id };
}

export async function leaveEvent(eventId: number, playerId: number) {
  const user = await getUser();
  if (!user) throw new Error("Sign in to leave an event.");
  const { player_id } = EventMemberInputSchema.parse({ player_id: playerId });
  await api.leaveEvent(eventId, player_id);
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const };
}

// --- Team channel notifications (web53a) -------------------------------------

/** Current effective notification state for the viewer's team channel —
 * seeds the captain modal (untouched knobs show the event's configured
 * verbosity). */
export async function getMyTeamNotifications(eventId: number, teamId: number) {
  const user = await getUser();
  if (!user) throw new Error("Sign in to manage team notifications.");
  return api.teamNotifications(eventId, teamId);
}

/** Captain-facing save of their team's Discord-channel notification toggles
 * and per-type @TeamRole pings (the Web API enforces the captain/leadership/
 * captain_config rules; event admins pass unconditionally). */
export async function saveMyTeamNotifications(
  eventId: number,
  teamId: number,
  input: {
    toggles?: Record<string, boolean>;
    pings?: Record<string, boolean>;
    task_progress?: "off" | "milestones" | "all";
  },
) {
  const user = await getUser();
  if (!user) throw new Error("Sign in to manage team notifications.");
  const result = await api.updateTeamNotifications(eventId, teamId, input);
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const, notifications: result };
}

// --- Team leadership (web48a) ------------------------------------------------

/** Assign a leader/co-leader (event admins; a leader may appoint their own
 * co-leader — the Web API enforces exactly that). */
export async function assignTeamLeadership(
  eventId: number,
  teamId: number,
  playerId: number,
  role: "leader" | "co_leader",
) {
  const user = await getUser();
  if (!user) throw new Error("Sign in to manage leadership.");
  await api.setTeamLeadership(eventId, teamId, playerId, role);
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/teams/${teamId}`);
  return { ok: true as const };
}

/** Remove a leadership role (admin / leader demoting a co-leader / the
 * holder stepping down — enforced server-side). */
export async function removeTeamLeadership(eventId: number, teamId: number, playerId: number) {
  const user = await getUser();
  if (!user) throw new Error("Sign in to manage leadership.");
  await api.clearTeamLeadership(eventId, teamId, playerId);
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/teams/${teamId}`);
  return { ok: true as const };
}

/** Cast/replace the viewer's leader vote (election mode). */
export async function voteForTeamLeader(eventId: number, teamId: number, candidateId: number) {
  const user = await getUser();
  if (!user) throw new Error("Sign in to vote.");
  const result = await api.castLeaderVote(eventId, teamId, candidateId);
  revalidatePath(`/events/${eventId}/teams/${teamId}`);
  return { ok: true as const, leader_player_id: result.leader_player_id };
}

// --- Board game (web44a) ---------------------------------------------------

/** The live board (tiles + positions). Draft visibility is enforced by the
 * Web API; anonymous viewers see active/past boards. */
export async function fetchPublicEventBoard(eventId: number) {
  return api.eventBoard(eventId);
}

/** Player-facing dice roll: the caller must be on the team and the event's
 * settings must allow team-triggered rolls — the Web API enforces both. */
export async function rollBoardAsMember(eventId: number, teamId?: number) {
  const user = await getUser();
  if (!user) throw new Error("Sign in to roll.");
  const result = await api.rollEventBoard(eventId, teamId);
  revalidatePath(`/events/${eventId}`);
  return result;
}

/** Shop catalog + the viewer's team wallet/inventory (web45a). */
export async function fetchBoardShop(eventId: number, teamId?: number) {
  const user = await getUser();
  if (!user) throw new Error("Sign in to browse the shop.");
  return api.eventBoardShop(eventId, teamId);
}

/** Buy a power-up with the team's coins (ownership enforced server-side). */
export async function buyBoardItem(eventId: number, shopItemId: number, teamId?: number) {
  const user = await getUser();
  if (!user) throw new Error("Sign in to buy.");
  const res = await api.buyEventBoardItem(eventId, shopItemId, teamId);
  revalidatePath(`/events/${eventId}`);
  return res;
}

/** Use an owned power-up. `value` drives numeric effects (choose_roll);
 * `targetTeamId`/`targetTileIdx` the targeted ones. */
export async function useBoardItem(
  eventId: number,
  inventoryId: number,
  opts: { teamId?: number; targetTeamId?: number; targetTileIdx?: number; value?: number } = {},
) {
  const user = await getUser();
  if (!user) throw new Error("Sign in to use items.");
  const res = await api.useEventBoardItem(eventId, inventoryId, opts);
  revalidatePath(`/events/${eventId}`);
  return res;
}

/** Resolve a pending task choice (choose_task items — Cache of Runes). */
export async function resolveBoardChoice(eventId: number, choiceIndex: number) {
  const user = await getUser();
  if (!user) throw new Error("Sign in to choose a task.");
  const res = await api.resolveEventBoardChoice(eventId, choiceIndex);
  revalidatePath(`/events/${eventId}`);
  return res;
}
