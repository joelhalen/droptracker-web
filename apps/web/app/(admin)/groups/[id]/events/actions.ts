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
import { hasEntitlement } from "@/lib/entitlements";

async function assertAdmin(groupId: number) {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
  return user;
}

async function assertEventsEntitlement(groupId: number) {
  const user = await assertAdmin(groupId);
  if (!user.is_superadmin) {
    const sub = await api.groupSubscription(groupId);
    if (!hasEntitlement(sub, "events")) {
      throw new Error("Events requires a higher subscription tier.");
    }
  }
  return user;
}

export async function createGroupEvent(groupId: number, input: Omit<EventInput, "group_id">) {
  await assertEventsEntitlement(groupId);
  const parsed = EventInputSchema.parse({ ...input, group_id: groupId });
  const result = await api.createEvent(parsed);
  revalidatePath(`/groups/${groupId}/events`);
  return { ok: true as const, id: result.id };
}

export async function updateGroupEvent(
  groupId: number,
  eventId: number,
  patch: Partial<Pick<EventInput, "name" | "description" | "starts_at" | "ends_at">>,
) {
  await assertEventsEntitlement(groupId);
  const parsed = EventInputSchema.omit({ group_id: true }).partial().parse(patch);
  const result = await api.updateEvent(eventId, parsed);
  revalidatePath(`/groups/${groupId}/events`);
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  return result;
}

export async function addEventTask(groupId: number, eventId: number, input: EventTaskInput) {
  await assertEventsEntitlement(groupId);
  const parsed = EventTaskInputSchema.parse(input);
  const result = await api.addEventTask(eventId, parsed);
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  return { ok: true as const, id: result.id };
}

export async function removeEventTask(groupId: number, eventId: number, taskId: number) {
  await assertEventsEntitlement(groupId);
  await api.deleteEventTask(eventId, taskId);
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  return { ok: true as const };
}

export async function addEventTeam(groupId: number, eventId: number, input: EventTeamInput) {
  await assertEventsEntitlement(groupId);
  const parsed = EventTeamInputSchema.parse(input);
  const result = await api.addEventTeam(eventId, parsed);
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  return { ok: true as const, id: result.id };
}
