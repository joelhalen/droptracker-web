"use server";

/**
 * Server Actions for the page builder (web137a): group pages, member profile
 * layouts and players' own profiles.
 *
 * They return a discriminated result instead of throwing, because Next
 * redacts thrown Server Action messages in production and the builder needs
 * the backend's real validation text ("Block 3 (Buttons): links must start
 * with https://"). The Web API does every permission and entitlement check;
 * the guard here only stops obviously wrong callers early.
 */
import { revalidatePath, revalidateTag } from "next/cache";
import type { LayoutBuilderState, LayoutScope, PageLayout } from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { layoutTag } from "@/lib/api/page-layouts";
import { canAdminGroup, getUser } from "@/lib/auth";

export type BuilderResult = { ok: true; state: LayoutBuilderState } | { ok: false; error: string; code?: string };

function fail(err: unknown): BuilderResult {
  if (err instanceof ApiError) {
    const code = typeof err.problem?.code === "string" ? err.problem.code : undefined;
    return { ok: false, error: err.message, code };
  }
  return { ok: false, error: "Something went wrong. Please try again." };
}

async function guard(scope: LayoutScope, id: number): Promise<string | null> {
  const user = await getUser();
  if (!user) return "Your session has ended. Sign in again to keep editing.";
  if (scope !== "player" && !canAdminGroup(user, id)) return "You don't administer this group.";
  return null;
}

function revalidateLive(scope: LayoutScope, id: number) {
  if (scope === "group") {
    revalidateTag(layoutTag("group", id));
    revalidatePath(`/groups/${id}`);
  } else if (scope === "player") {
    revalidateTag(layoutTag("player", id));
    revalidatePath(`/players/${id}`);
  }
  // member_default: each member's profile re-reads its layout within its
  // 30s cache window; there is no per-group tag over every member.
}

export async function saveLayoutDraftAction(
  scope: LayoutScope,
  id: number,
  layout: PageLayout,
): Promise<BuilderResult> {
  try {
    const denied = await guard(scope, id);
    if (denied) return { ok: false, error: denied };
    return { ok: true, state: await api.saveLayoutDraft(scope, id, layout) };
  } catch (err) {
    return fail(err);
  }
}

export async function publishLayoutAction(scope: LayoutScope, id: number): Promise<BuilderResult> {
  try {
    const denied = await guard(scope, id);
    if (denied) return { ok: false, error: denied };
    const state = await api.publishLayout(scope, id);
    revalidateLive(scope, id);
    return { ok: true, state };
  } catch (err) {
    return fail(err);
  }
}

export async function unpublishLayoutAction(scope: LayoutScope, id: number): Promise<BuilderResult> {
  try {
    const denied = await guard(scope, id);
    if (denied) return { ok: false, error: denied };
    const state = await api.unpublishLayout(scope, id);
    revalidateLive(scope, id);
    return { ok: true, state };
  } catch (err) {
    return fail(err);
  }
}

export async function discardLayoutDraftAction(scope: LayoutScope, id: number): Promise<BuilderResult> {
  try {
    const denied = await guard(scope, id);
    if (denied) return { ok: false, error: denied };
    return { ok: true, state: await api.discardLayoutDraft(scope, id) };
  } catch (err) {
    return fail(err);
  }
}

/** Boss-name autocomplete for the boss leaderboard block. */
export async function searchBuilderNpcs(q: string) {
  if (q.trim().length < 2) return [];
  return api.searchEventNpcs(q.trim()).catch(() => []);
}
