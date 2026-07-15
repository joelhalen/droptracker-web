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

/** Use an owned power-up. */
export async function useBoardItem(
  eventId: number,
  inventoryId: number,
  opts: { teamId?: number; targetTeamId?: number; targetTileIdx?: number } = {},
) {
  const user = await getUser();
  if (!user) throw new Error("Sign in to use items.");
  const res = await api.useEventBoardItem(eventId, inventoryId, opts);
  revalidatePath(`/events/${eventId}`);
  return res;
}
