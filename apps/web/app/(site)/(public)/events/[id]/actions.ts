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
