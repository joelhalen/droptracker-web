"use server";

/**
 * Clan-point awards (web114a) — the manager tab's Server Actions. Kept apart
 * from the big events actions module: every call is scoped to the group the
 * manager page is open under, since each clan runs its own payout (a
 * clan-vs-clan opponent configures what ITS members earn).
 *
 * Results ride the return value rather than throwing — Next redacts thrown
 * Server Action errors, and the Web API's reasons ("the event hasn't ended
 * yet", "EHE can't be priced right now") are the whole point of the message.
 */
import { revalidatePath } from "next/cache";
import type { EventClanPoints, EventClanPointsConfigInput } from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { canManageEvents, getUser } from "@/lib/auth";

export type ClanPointsResult =
  | { ok: true; data: EventClanPoints }
  | { ok: false; message: string };

async function assertCanManage(groupId: number) {
  const user = await getUser();
  if (!user) throw new Error("Forbidden: sign in required.");
  // The Web API is authoritative (clan admins + event managers of THIS
  // clan); this only stops obviously-unauthorised callers early.
  if (!user.is_superadmin && !canManageEvents(user, groupId)) {
    throw new Error("Forbidden: you cannot manage this group's events.");
  }
}

function failed(err: unknown, fallback: string): ClanPointsResult {
  if (err instanceof ApiError) return { ok: false, message: err.message || fallback };
  throw err;
}

function revalidate(groupId: number, eventId: number) {
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  revalidatePath(`/events/${eventId}`);
}

export async function fetchEventClanPoints(
  groupId: number,
  eventId: number,
): Promise<ClanPointsResult> {
  await assertCanManage(groupId);
  try {
    return { ok: true, data: await api.eventClanPoints(eventId, { groupId, preview: true }) };
  } catch (err) {
    return failed(err, "Couldn't load the clan-point awards.");
  }
}

export async function saveEventClanPoints(
  groupId: number,
  eventId: number,
  config: EventClanPointsConfigInput,
): Promise<ClanPointsResult> {
  await assertCanManage(groupId);
  try {
    const data = await api.updateEventClanPoints(eventId, groupId, config);
    revalidate(groupId, eventId);
    return { ok: true, data };
  } catch (err) {
    return failed(err, "Couldn't save the clan-point awards.");
  }
}

export async function awardEventClanPoints(
  groupId: number,
  eventId: number,
): Promise<ClanPointsResult> {
  await assertCanManage(groupId);
  try {
    const data = await api.awardEventClanPoints(eventId, groupId);
    revalidate(groupId, eventId);
    revalidatePath(`/groups/${groupId}/points/manage`);
    return { ok: true, data };
  } catch (err) {
    return failed(err, "Couldn't award the clan points.");
  }
}

export async function revokeEventClanPoints(
  groupId: number,
  eventId: number,
): Promise<ClanPointsResult> {
  await assertCanManage(groupId);
  try {
    const data = await api.revokeEventClanPoints(eventId, groupId);
    revalidate(groupId, eventId);
    revalidatePath(`/groups/${groupId}/points/manage`);
    return { ok: true, data };
  } catch (err) {
    return failed(err, "Couldn't revoke the clan points.");
  }
}
