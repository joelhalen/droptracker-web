"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  EMBED_TYPES,
  EventMessageLayoutInputSchema,
  GroupEmbedInputSchema,
  NotificationLayoutInputSchema,
  type EmbedType,
  type EventMessageLayout,
  type EventMessageLayoutInput,
  type GroupEmbed,
  type GroupEmbedInput,
  type NotificationLayoutInput,
  type SavedNotificationLayout,
} from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { getUser } from "@/lib/auth";

/**
 * Server Actions for the staff Default embeds page. They write the template
 * group's designs — what every group without its own is sent — so each one
 * re-checks superadmin before calling a Web API that checks again.
 *
 * Same discriminated result as the group editors' actions (Next redacts thrown
 * Server Action errors in production), because the same editor components
 * call these and show the backend's validation detail as-is.
 */
export type DefaultsActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const PAGE = "/admin/embeds";
const FORBIDDEN = "Forbidden: only site staff can change the defaults.";

function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

async function isStaff(): Promise<boolean> {
  const user = await getUser();
  return Boolean(user?.is_superadmin);
}

function assertEmbedType(embedType: string): asserts embedType is EmbedType {
  if (!EMBED_TYPES.includes(embedType as EmbedType)) {
    throw new Error(`Unknown embed type '${embedType}'.`);
  }
}

/** Save the default embed template for one notification type. */
export async function saveEmbedDefaultAction(
  embedType: string,
  input: GroupEmbedInput,
): Promise<DefaultsActionResult<GroupEmbed>> {
  try {
    if (!(await isStaff())) return { ok: false, error: FORBIDDEN };
    assertEmbedType(embedType);
    const saved = await api.saveEmbedDefault(embedType, GroupEmbedInputSchema.parse(input));
    revalidatePath(PAGE);
    return { ok: true, data: saved };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

/** Delete a stored default so the type is sent its built-in embed again. */
export async function resetEmbedDefaultAction(
  embedType: string,
): Promise<DefaultsActionResult<null>> {
  try {
    if (!(await isStaff())) return { ok: false, error: FORBIDDEN };
    assertEmbedType(embedType);
    await api.deleteEmbedDefault(embedType);
    revalidatePath(PAGE);
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

/** Save the default layout for one event message type. */
export async function saveEventLayoutDefaultAction(
  messageType: string,
  input: EventMessageLayoutInput,
): Promise<DefaultsActionResult<EventMessageLayout>> {
  try {
    if (!(await isStaff())) return { ok: false, error: FORBIDDEN };
    const saved = await api.saveEventLayoutDefault(
      messageType,
      EventMessageLayoutInputSchema.parse(input),
    );
    revalidatePath(PAGE);
    return { ok: true, data: saved };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

/** Delete an edited event layout default; the built-in one is sent again. */
export async function resetEventLayoutDefaultAction(
  messageType: string,
): Promise<DefaultsActionResult<null>> {
  try {
    if (!(await isStaff())) return { ok: false, error: FORBIDDEN };
    await api.deleteEventLayoutDefault(messageType);
    revalidatePath(PAGE);
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

/** Save the starting layout groups copy for one notification type. */
export async function saveNotificationLayoutDefaultAction(
  notificationType: string,
  input: NotificationLayoutInput,
): Promise<DefaultsActionResult<SavedNotificationLayout>> {
  try {
    if (!(await isStaff())) return { ok: false, error: FORBIDDEN };
    const parsed = NotificationLayoutInputSchema.parse({ ...input, active: false });
    const saved = await api.saveNotificationLayoutDefault(notificationType, parsed);
    revalidatePath(PAGE);
    return { ok: true, data: saved };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

/** Delete an edited starting layout; groups start from the built-in again. */
export async function resetNotificationLayoutDefaultAction(
  notificationType: string,
): Promise<DefaultsActionResult<null>> {
  try {
    if (!(await isStaff())) return { ok: false, error: FORBIDDEN };
    await api.deleteNotificationLayoutDefault(notificationType);
    revalidatePath(PAGE);
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}
