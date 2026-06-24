"use server";

import { revalidatePath } from "next/cache";
import {
  EventInputSchema,
  EventTaskInputSchema,
  EventTeamInputSchema,
  type EventInput,
  type EventTaskInput,
  type EventTeamInput,
} from "@droptracker/api-types";
import { api } from "@/lib/api";
import { getUser, canAdminGroup } from "@/lib/auth";

async function assertAdmin(groupId: number) {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
}

export async function createGroupEvent(groupId: number, input: Omit<EventInput, "group_id">) {
  await assertAdmin(groupId);
  const parsed = EventInputSchema.parse({ ...input, group_id: groupId });
  const result = await api.createEvent(parsed);
  revalidatePath(`/groups/${groupId}/events`);
  return { ok: true as const, id: result.id };
}

export async function addEventTask(groupId: number, eventId: number, input: EventTaskInput) {
  await assertAdmin(groupId);
  const parsed = EventTaskInputSchema.parse(input);
  const result = await api.addEventTask(eventId, parsed);
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  return { ok: true as const, id: result.id };
}

export async function removeEventTask(groupId: number, eventId: number, taskId: number) {
  await assertAdmin(groupId);
  await api.deleteEventTask(eventId, taskId);
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  return { ok: true as const };
}

export async function addEventTeam(groupId: number, eventId: number, input: EventTeamInput) {
  await assertAdmin(groupId);
  const parsed = EventTeamInputSchema.parse(input);
  const result = await api.addEventTeam(eventId, parsed);
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  return { ok: true as const, id: result.id };
}
