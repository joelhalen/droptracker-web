/**
 * Server-side auth helpers for authed route groups. The API is the source of
 * truth (FRONTEND_PLAN.md §7.2); these helpers resolve the session via the BFF
 * client and gate rendering.
 *
 * Two rejection styles (web57a):
 *  - `requireUser` (personal pages — dashboard, settings, tickets): signing in
 *    always suffices, so it redirects straight into Discord OAuth and returns
 *    here — no interstitial worth showing.
 *  - `requireSuperadmin` / `requireDeveloper` (role-gated subtrees): signing
 *    in may NOT suffice, so these throw `unauthorized()` / `forbidden()`
 *    instead — rendering the (site) interrupt boundaries with an explanation
 *    (and a sign-in button on the 401 side) rather than silently bouncing
 *    the visitor home.
 */
import { forbidden, redirect, unauthorized } from "next/navigation";
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

/** Require site-staff (superadmin); non-staff get the 403 interrupt page,
 *  signed-out visitors the 401 sign-in page. The `_returnTo` argument is
 *  vestigial (the unauthorized boundary derives the return path from the
 *  URL); kept so the ~50 existing call sites don't churn. */
export async function requireSuperadmin(_returnTo?: string): Promise<Me> {
  const user = await getUser();
  if (!user) unauthorized();
  if (!user.is_superadmin) forbidden();
  return user;
}

/** Require developer-or-superadmin; same rejection shape as requireSuperadmin.
 *  Gates the shared /admin shell — superadmin-only pages inside it re-assert
 *  `requireSuperadmin` themselves (the layout gate alone is not enough). */
export async function requireDeveloper(_returnTo?: string): Promise<Me> {
  const user = await getUser();
  if (!user) unauthorized();
  if (!user.is_developer && !user.is_superadmin) forbidden();
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

/**
 * Whether the user may change who administers this group (web86a): add/remove
 * admins, transfer ownership, flip the Discord-perms policy.
 *
 * Since web86a a `role` of "owner" can only come from the group's single
 * `group_admins` owner row — Discord MANAGE_GUILD now resolves to "admin" — so
 * the role check alone is exact. Superadmins short-circuit for the same reason
 * `canAdminGroup` does: they may not appear in `user.groups` at all.
 *
 * The backend enforces this independently (`deps.assert_group_owner`); this is
 * for deciding what to render.
 */
export function isGroupOwner(user: Me, groupId: number): boolean {
  if (user.is_superadmin) return true;
  return groupRole(user, groupId) === "owner";
}

/**
 * True when the group has no owner at all — the web86a migration could not
 * attribute it, so any of its admins may claim the seat once.
 *
 * Distinguishes `null` (ownerless) from `undefined` (viewer isn't an admin and
 * wasn't told), so a member never sees the claim prompt.
 */
export function isGroupOwnerless(user: Me, groupId: number): boolean {
  const entry = user.groups.find((g) => g.id === groupId);
  return entry !== undefined && entry.owner_user_id === null;
}

/**
 * Guard an owner-only group page. Same rejection shape as
 * `requireGroupAdminPage` — the 403 interrupt, not a silent bounce.
 */
export async function requireGroupOwnerPage(groupId: number): Promise<Me> {
  const user = await requireUser(`/groups/${groupId}/admin`);
  if (!isGroupOwner(user, groupId)) forbidden();
  return user;
}

/**
 * Whether the user may manage this group's EVENTS (web64a): any group admin, or
 * a member granted the event-manager role (`can_manage_events` on the `/me`
 * group entry). Event managers reach the Events admin surface WITHOUT full
 * group-admin access — every non-events admin page still gates on
 * `canAdminGroup`, and the backend independently enforces both.
 */
export function canManageEvents(user: Me, groupId: number): boolean {
  if (canAdminGroup(user, groupId)) return true;
  return user.groups.find((g) => g.id === groupId)?.can_manage_events === true;
}

/**
 * Guard a NON-events group-admin page (settings, members, subscription, …).
 * The shared `(admin)/groups/[id]` layout now admits event managers so they can
 * reach the Events subtree, so every other admin page must re-assert full group
 * admin here (web64a). Returns the user or renders the 403 interrupt.
 */
export async function requireGroupAdminPage(groupId: number): Promise<Me> {
  const user = await requireUser(`/groups/${groupId}/admin`);
  if (!canAdminGroup(user, groupId)) forbidden();
  return user;
}
