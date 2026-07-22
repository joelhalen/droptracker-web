"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  EventMessageLayoutInputSchema,
  type EventLayoutMeta,
  type EventLayoutsResponse,
  type EventMessageLayout,
  type EventMessageLayoutInput,
} from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { getUser, canAdminGroup, canManageEvents } from "@/lib/auth";
import { hasEntitlement } from "@/lib/entitlements";

/**
 * Server Actions for the event message-layout editor (web66a) — group-level
 * layouts and per-event overrides. Same discriminated-result pattern as the
 * embed actions: Next redacts thrown Server Action errors in production, and
 * the editor needs the backend's real validation/entitlement detail.
 */
export type LayoutActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

/** Save the group's default layout for one event message type. */
export async function saveGroupEventLayoutAction(
  groupId: number,
  messageType: string,
  input: EventMessageLayoutInput,
): Promise<LayoutActionResult<EventMessageLayout>> {
  try {
    const user = await getUser();
    if (!user || !canAdminGroup(user, groupId)) {
      return { ok: false, error: "Forbidden: you do not administer this group." };
    }
    if (!user.is_superadmin) {
      const sub = await api.groupSubscription(groupId);
      if (!hasEntitlement(sub, "custom_embeds")) {
        return { ok: false, error: "Custom event layouts require a higher subscription tier." };
      }
    }
    const parsed = EventMessageLayoutInputSchema.parse(input);
    const saved = await api.saveGroupEventLayout(groupId, messageType, parsed);
    revalidatePath(`/groups/${groupId}/embeds`);
    return { ok: true, data: saved };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

/** Remove the group's layout for one type (revert to the system default). */
export async function resetGroupEventLayoutAction(
  groupId: number,
  messageType: string,
): Promise<LayoutActionResult<null>> {
  try {
    const user = await getUser();
    if (!user || !canAdminGroup(user, groupId)) {
      return { ok: false, error: "Forbidden: you do not administer this group." };
    }
    await api.deleteGroupEventLayout(groupId, messageType);
    revalidatePath(`/groups/${groupId}/embeds`);
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

function canTouchEvent(
  user: Awaited<ReturnType<typeof getUser>>,
  groupId: number | null,
): boolean {
  if (!user) return false;
  // Global events (no host group) are superadmin territory; the Web API
  // re-checks with full clan-vs-clan co-manager semantics either way.
  return groupId == null ? Boolean(user.is_superadmin) : canManageEvents(user, groupId);
}

/** One event's overrides + effective layouts (drives the per-event section). */
export async function getEventLayoutsAction(
  groupId: number | null,
  eventId: number,
): Promise<LayoutActionResult<EventLayoutsResponse>> {
  try {
    const user = await getUser();
    if (!canTouchEvent(user, groupId)) {
      return { ok: false, error: "Forbidden: you do not manage this event." };
    }
    return { ok: true, data: await api.eventLayouts(eventId) };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

/** Editor metadata (types, token docs, limits) — static per deploy. */
export async function getEventLayoutMetaAction(): Promise<LayoutActionResult<EventLayoutMeta>> {
  try {
    const user = await getUser();
    if (!user) return { ok: false, error: "Sign in to edit layouts." };
    return { ok: true, data: await api.eventLayoutMeta() };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

/** Save a one-event layout override for one message type. */
export async function saveEventLayoutAction(
  groupId: number | null,
  eventId: number,
  messageType: string,
  input: EventMessageLayoutInput,
): Promise<LayoutActionResult<EventMessageLayout>> {
  try {
    const user = await getUser();
    if (!canTouchEvent(user, groupId)) {
      return { ok: false, error: "Forbidden: you do not manage this event." };
    }
    const parsed = EventMessageLayoutInputSchema.parse(input);
    const saved = await api.saveEventLayout(eventId, messageType, parsed);
    if (groupId != null) revalidatePath(`/groups/${groupId}/events/${eventId}`);
    return { ok: true, data: saved };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

/** Remove a one-event override (revert to the group's layout). */
export async function resetEventLayoutAction(
  groupId: number | null,
  eventId: number,
  messageType: string,
): Promise<LayoutActionResult<null>> {
  try {
    const user = await getUser();
    if (!canTouchEvent(user, groupId)) {
      return { ok: false, error: "Forbidden: you do not manage this event." };
    }
    await api.deleteEventLayout(eventId, messageType);
    if (groupId != null) revalidatePath(`/groups/${groupId}/events/${eventId}`);
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}
