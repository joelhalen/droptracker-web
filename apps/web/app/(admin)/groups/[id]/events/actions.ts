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

/** Event scope: a group id, or `null` for global events (superadmin-only —
 * PRD D6). Every action below accepts both so the same EventManager UI can
 * drive group events (/groups/[id]/events) and global events (/admin/events). */
type EventGroupId = number | null;

async function assertEventsEntitlement(groupId: EventGroupId) {
  const user = await getUser();
  if (!user) throw new Error("Forbidden: sign in required.");
  if (groupId == null) {
    // Global events: site staff only; no group entitlement applies.
    if (!user.is_superadmin) {
      throw new Error("Forbidden: global events are managed by site staff.");
    }
    return user;
  }
  if (!canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
  if (!user.is_superadmin) {
    const sub = await api.groupSubscription(groupId);
    if (!hasEntitlement(sub, "events")) {
      throw new Error("Events requires a higher subscription tier.");
    }
  }
  return user;
}

/** Where this event's admin surfaces live (group manager vs superadmin area). */
function eventsIndexPath(groupId: EventGroupId): string {
  return groupId == null ? "/admin/events" : `/groups/${groupId}/events`;
}

function eventAdminPath(groupId: EventGroupId, eventId: number): string {
  return groupId == null ? `/admin/events/${eventId}` : `/groups/${groupId}/events/${eventId}`;
}

export async function createGroupEvent(
  groupId: EventGroupId,
  input: Omit<EventInput, "group_id">,
) {
  await assertEventsEntitlement(groupId);
  const parsed = EventInputSchema.parse({ ...input, group_id: groupId });
  const result = await api.createEvent(parsed);
  revalidatePath(eventsIndexPath(groupId));
  return { ok: true as const, id: result.id };
}

export async function updateGroupEvent(
  groupId: EventGroupId,
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
  revalidatePath(eventsIndexPath(groupId));
  revalidatePath(eventAdminPath(groupId, eventId));
  return result;
}

// --- Lifecycle (Task 21) -----------------------------------------------------

/** Explicit activation (draft -> active). Surfaces the API's pre-flight
 * validation (422) and tier concurrency (409) messages to the UI. */
export async function activateEvent(groupId: EventGroupId, eventId: number) {
  await assertEventsEntitlement(groupId);
  const detail = await api.activateEvent(eventId);
  revalidatePath(eventsIndexPath(groupId));
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return detail;
}

/** Explicit end (active -> past). Final standings are announced to Discord. */
export async function endEvent(groupId: EventGroupId, eventId: number) {
  await assertEventsEntitlement(groupId);
  const detail = await api.endEvent(eventId);
  revalidatePath(eventsIndexPath(groupId));
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return detail;
}

export async function addEventTask(groupId: EventGroupId, eventId: number, input: EventTaskInput) {
  await assertEventsEntitlement(groupId);
  const parsed = EventTaskInputSchema.parse(input);
  const result = await api.addEventTask(eventId, parsed);
  revalidatePath(eventAdminPath(groupId, eventId));
  return { ok: true as const, id: result.id };
}

export async function removeEventTask(groupId: EventGroupId, eventId: number, taskId: number) {
  await assertEventsEntitlement(groupId);
  await api.deleteEventTask(eventId, taskId);
  revalidatePath(eventAdminPath(groupId, eventId));
  return { ok: true as const };
}

export async function addEventTeam(groupId: EventGroupId, eventId: number, input: EventTeamInput) {
  await assertEventsEntitlement(groupId);
  const parsed = EventTeamInputSchema.parse(input);
  const result = await api.addEventTeam(eventId, parsed);
  revalidatePath(eventAdminPath(groupId, eventId));
  return { ok: true as const, id: result.id };
}

/** Admin roster add — also moves a player already on another team in this
 * event (their join timestamp, the credit cutoff, resets on the new team). */
export async function addEventTeamMember(
  groupId: EventGroupId,
  eventId: number,
  teamId: number,
  playerId: number,
) {
  await assertEventsEntitlement(groupId);
  await api.addEventTeamMember(eventId, teamId, playerId);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const };
}

export async function removeEventTeamMember(
  groupId: EventGroupId,
  eventId: number,
  teamId: number,
  playerId: number,
) {
  await assertEventsEntitlement(groupId);
  await api.removeEventTeamMember(eventId, teamId, playerId);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const };
}

/** Search players for the roster add-player picker. Group events search the
 * group's members; global events (superadmin) search all players. */
export async function searchGroupPlayers(groupId: EventGroupId, q: string) {
  await assertEventsEntitlement(groupId);
  if (groupId == null) {
    const res = await api.adminLookup(q.trim());
    return res.results
      .filter((r) => r.category === "player")
      .map((r) => ({ id: Number(r.id), name: r.label }))
      .filter((p) => Number.isFinite(p.id));
  }
  const page = await api.groupMembers(groupId, 1, q.trim());
  return page.members.map((m) => ({ id: m.id, name: m.name }));
}

// --- Bingo designer (Task 20) ------------------------------------------------

/** Replace the event's whole bingo board. Returns the refreshed event detail
 * (the PUT may create/delete tasks, so the manager's task list changes too).
 * The API answers 409 once the event has started. */
export async function saveEventBingo(groupId: EventGroupId, eventId: number, input: BingoBoardInput) {
  await assertEventsEntitlement(groupId);
  const parsed = BingoBoardInputSchema.parse(input);
  await api.saveEventBingo(eventId, parsed);
  const detail = await api.eventForAdmin(eventId);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return detail;
}

/** Search the curated task-preset library for the designer picker. */
export async function searchEventTaskLibrary(
  groupId: EventGroupId,
  params: { query?: string; type?: string; page?: number } = {},
) {
  await assertEventsEntitlement(groupId);
  return api.eventTaskLibrary(params);
}

// --- Verification queue & manual actions (Task 18) --------------------------

/** Admin-only completion ledger read (used by the Review section refresh). */
export async function listEventCompletions(
  groupId: EventGroupId,
  eventId: number,
  params: { status?: string; teamId?: number; taskId?: number } = {},
) {
  await assertEventsEntitlement(groupId);
  return api.eventCompletions(eventId, params);
}

export async function confirmEventCompletion(
  groupId: EventGroupId,
  eventId: number,
  completionId: number,
) {
  await assertEventsEntitlement(groupId);
  await api.confirmEventCompletion(eventId, completionId);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const };
}

export async function rejectEventCompletion(
  groupId: EventGroupId,
  eventId: number,
  completionId: number,
  note?: string,
) {
  await assertEventsEntitlement(groupId);
  await api.rejectEventCompletion(eventId, completionId, note);
  revalidatePath(eventAdminPath(groupId, eventId));
  return { ok: true as const };
}

/** Manual award — the escape hatch for pre-join credit and custom/ehp/ehb tasks. */
export async function awardEventCompletion(
  groupId: EventGroupId,
  eventId: number,
  input: EventAwardInput,
) {
  await assertEventsEntitlement(groupId);
  const parsed = EventAwardInputSchema.parse(input);
  const result = await api.awardEventCompletion(eventId, parsed);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const, id: result.id };
}

export async function revokeEventCompletion(
  groupId: EventGroupId,
  eventId: number,
  input: EventRevokeInput,
) {
  await assertEventsEntitlement(groupId);
  const parsed = EventRevokeInputSchema.parse(input);
  await api.revokeEventCompletion(eventId, parsed);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const };
}

// --- Discord destinations (Task 19) ----------------------------------------

/** The event's Discord destination config (guild + per-kind channels). */
export async function getEventDiscord(groupId: EventGroupId, eventId: number) {
  await assertEventsEntitlement(groupId);
  return api.eventDiscord(eventId);
}

/** Every guild the bot is in, for the guild picker (bot Redis cache). */
export async function listEventDiscordGuilds(groupId: EventGroupId) {
  await assertEventsEntitlement(groupId);
  return api.eventDiscordGuilds();
}

/** Text channels of one guild — works for any guild the bot is in, so events
 * can target dedicated event servers. Stale ⇒ manual-id fallback in the UI. */
export async function listEventDiscordChannels(groupId: EventGroupId, guildId: string) {
  await assertEventsEntitlement(groupId);
  return api.eventDiscordChannels(guildId);
}

/** Replace the event's Discord destination; `guild_id: null` clears it. */
export async function saveEventDiscord(
  groupId: EventGroupId,
  eventId: number,
  input: EventChannelConfigInput,
) {
  await assertEventsEntitlement(groupId);
  const parsed = EventChannelConfigInputSchema.parse(input);
  const result = await api.updateEventDiscord(eventId, parsed);
  revalidatePath(eventAdminPath(groupId, eventId));
  return result;
}

/** Per-task edits (requires_confirmation toggle, points, label, target…). */
export async function updateEventTask(
  groupId: EventGroupId,
  eventId: number,
  taskId: number,
  patch: EventTaskPatch,
) {
  await assertEventsEntitlement(groupId);
  const parsed = EventTaskPatchSchema.parse(patch);
  const result = await api.updateEventTask(eventId, taskId, parsed);
  revalidatePath(eventAdminPath(groupId, eventId));
  return result;
}
