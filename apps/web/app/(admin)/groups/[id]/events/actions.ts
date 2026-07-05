"use server";

import { revalidatePath } from "next/cache";
import {
  BingoBoardInputSchema,
  EventAwardInputSchema,
  EventChannelConfigInputSchema,
  EventInputSchema,
  EventRevokeInputSchema,
  EventTaskInputSchema,
  EventTaskPatchSchema,
  EventTeamInputSchema,
  type BingoBoardInput,
  type EventAwardInput,
  type EventChannelConfigInput,
  type EventInput,
  type EventRevokeInput,
  type EventTaskInput,
  type EventTaskPatch,
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
  patch: Partial<
    Pick<
      EventInput,
      | "name"
      | "description"
      | "starts_at"
      | "ends_at"
      | "formation_mode"
      | "join_code"
      | "requires_confirmation"
      | "bonus_line_points"
      | "bonus_blackout_points"
    >
  >,
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

/** Admin roster add — also moves a player already on another team in this
 * event (their join timestamp, the credit cutoff, resets on the new team). */
export async function addEventTeamMember(
  groupId: number,
  eventId: number,
  teamId: number,
  playerId: number,
) {
  await assertEventsEntitlement(groupId);
  await api.addEventTeamMember(eventId, teamId, playerId);
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const };
}

export async function removeEventTeamMember(
  groupId: number,
  eventId: number,
  teamId: number,
  playerId: number,
) {
  await assertEventsEntitlement(groupId);
  await api.removeEventTeamMember(eventId, teamId, playerId);
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const };
}

/** Search the group's members by name for the roster add-player picker. */
export async function searchGroupPlayers(groupId: number, q: string) {
  await assertEventsEntitlement(groupId);
  const page = await api.groupMembers(groupId, 1, q.trim());
  return page.members.map((m) => ({ id: m.id, name: m.name }));
}

// --- Bingo designer (Task 20) ------------------------------------------------

/** Replace the event's whole bingo board. Returns the refreshed event detail
 * (the PUT may create/delete tasks, so the manager's task list changes too).
 * The API answers 409 once the event has started. */
export async function saveEventBingo(groupId: number, eventId: number, input: BingoBoardInput) {
  await assertEventsEntitlement(groupId);
  const parsed = BingoBoardInputSchema.parse(input);
  await api.saveEventBingo(eventId, parsed);
  const detail = await api.eventForAdmin(eventId);
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  revalidatePath(`/events/${eventId}`);
  return detail;
}

/** Search the curated task-preset library for the designer picker. */
export async function searchEventTaskLibrary(
  groupId: number,
  params: { query?: string; type?: string; page?: number } = {},
) {
  await assertEventsEntitlement(groupId);
  return api.eventTaskLibrary(params);
}

// --- Verification queue & manual actions (Task 18) --------------------------

/** Admin-only completion ledger read (used by the Review section refresh). */
export async function listEventCompletions(
  groupId: number,
  eventId: number,
  params: { status?: string; teamId?: number; taskId?: number } = {},
) {
  await assertEventsEntitlement(groupId);
  return api.eventCompletions(eventId, params);
}

export async function confirmEventCompletion(groupId: number, eventId: number, completionId: number) {
  await assertEventsEntitlement(groupId);
  await api.confirmEventCompletion(eventId, completionId);
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const };
}

export async function rejectEventCompletion(
  groupId: number,
  eventId: number,
  completionId: number,
  note?: string,
) {
  await assertEventsEntitlement(groupId);
  await api.rejectEventCompletion(eventId, completionId, note);
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  return { ok: true as const };
}

/** Manual award — the escape hatch for pre-join credit and custom/ehp/ehb tasks. */
export async function awardEventCompletion(groupId: number, eventId: number, input: EventAwardInput) {
  await assertEventsEntitlement(groupId);
  const parsed = EventAwardInputSchema.parse(input);
  const result = await api.awardEventCompletion(eventId, parsed);
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const, id: result.id };
}

export async function revokeEventCompletion(groupId: number, eventId: number, input: EventRevokeInput) {
  await assertEventsEntitlement(groupId);
  const parsed = EventRevokeInputSchema.parse(input);
  await api.revokeEventCompletion(eventId, parsed);
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const };
}

// --- Discord destinations (Task 19) ----------------------------------------

/** The event's Discord destination config (guild + per-kind channels). */
export async function getEventDiscord(groupId: number, eventId: number) {
  await assertEventsEntitlement(groupId);
  return api.eventDiscord(eventId);
}

/** Every guild the bot is in, for the guild picker (bot Redis cache). */
export async function listEventDiscordGuilds(groupId: number) {
  await assertEventsEntitlement(groupId);
  return api.eventDiscordGuilds();
}

/** Text channels of one guild — works for any guild the bot is in, so events
 * can target dedicated event servers. Stale ⇒ manual-id fallback in the UI. */
export async function listEventDiscordChannels(groupId: number, guildId: string) {
  await assertEventsEntitlement(groupId);
  return api.eventDiscordChannels(guildId);
}

/** Replace the event's Discord destination; `guild_id: null` clears it. */
export async function saveEventDiscord(
  groupId: number,
  eventId: number,
  input: EventChannelConfigInput,
) {
  await assertEventsEntitlement(groupId);
  const parsed = EventChannelConfigInputSchema.parse(input);
  const result = await api.updateEventDiscord(eventId, parsed);
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  return result;
}

/** Per-task edits (requires_confirmation toggle, points, label, target…). */
export async function updateEventTask(
  groupId: number,
  eventId: number,
  taskId: number,
  patch: EventTaskPatch,
) {
  await assertEventsEntitlement(groupId);
  const parsed = EventTaskPatchSchema.parse(patch);
  const result = await api.updateEventTask(eventId, taskId, parsed);
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  return result;
}
