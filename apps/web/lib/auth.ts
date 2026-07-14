/**
 * Server-side auth helpers for authed route groups. The API is the source of
 * truth (FRONTEND_PLAN.md §7.2); these helpers resolve the session via the BFF
 * client and gate rendering.
 */
import { redirect } from "next/navigation";
import type { Me } from "@droptracker/api-types";
import { api } from "./api";

/** Current user, or null if not signed in. */
export async function getUser(): Promise<Me | null> {
  return api.me();
}

/** Require a session; redirect to sign-in (returning here) if absent. */
export async function requireUser(returnTo: string): Promise<Me> {
  const user = await getUser();
  if (!user) redirect(`/api/auth/login?redirect=${encodeURIComponent(returnTo)}`);
  return user;
}

/** Require site-staff (superadmin); send non-staff home (FRONTEND_PLAN.md §9). */
export async function requireSuperadmin(returnTo: string): Promise<Me> {
  const user = await requireUser(returnTo);
  if (!user.is_superadmin) redirect("/");
  return user;
}

/** Require moderator-or-superadmin; send others home. Gates /moderation. */
export async function requireModerator(returnTo: string): Promise<Me> {
  const user = await requireUser(returnTo);
  if (!user.is_moderator && !user.is_superadmin) redirect("/");
  return user;
}

/** Roles a user holds on a group, derived from the `/me` payload. */
export function groupRole(user: Me, groupId: number): "owner" | "admin" | "member" | null {
  return user.groups.find((g) => g.id === groupId)?.role ?? null;
}

/**
 * Superadmins can administer any group (as if they were its owner), even ones
 * they've never joined — mirrors the backend's `resolve_group_role` (which
 * they wouldn't even appear as a member of in `user.groups` for, so this must
 * short-circuit rather than rely on the per-group role lookup below).
 */
export function canAdminGroup(user: Me, groupId: number): boolean {
  if (user.is_superadmin) return true;
  const role = groupRole(user, groupId);
  return role === "owner" || role === "admin";
}
