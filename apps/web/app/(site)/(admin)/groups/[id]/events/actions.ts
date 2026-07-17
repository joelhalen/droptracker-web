"use server";

import { revalidatePath } from "next/cache";
import {
  BingoBoardInputSchema,
  BoardInputSchema,
  type BoardInput,
  BoardShopConfigInputSchema,
  type BoardShopConfigInput,
  EventAwardInputSchema,
  EventChannelConfigInputSchema,
  EventTeamDiscordInputSchema,
  type EventTeamDiscordInput,
  EventInputSchema,
  EventRevokeInputSchema,
  EventTaskInputSchema,
  EventTaskPatchSchema,
  EventTeamInputSchema,
  EventTeamPatchSchema,
  EventTemplateInstantiateInputSchema,
  EventTemplatePatchSchema,
  EventTemplateSaveInputSchema,
  type BingoBoardInput,
  type EventAwardInput,
  type EventChannelConfigInput,
  type EventDetail,
  type EventInput,
  type EventReadiness,
  type EventReadinessBlocker,
  type EventRevokeInput,
  type EventTaskInput,
  type EventTaskPatch,
  type EventTeamInput,
  type EventTeamPatch,
  type EventTemplateInstantiateInput,
  type EventTemplatePatch,
  type EventTemplateSaveInput,
  type EventParticipant,
  type EventPrizePot,
  type EventBuyinKind,
  type EventBuyinStatus,
  type EventPrizeDistribution,
} from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
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

/**
 * Manage-an-existing-event gate. Only requires admin rights on `groupId`
 * (or superadmin) — NOT the events entitlement. This is deliberate: a clan
 * challenged into a clan-vs-clan event co-manages it without its own paid
 * tier (only the host pays). The Web API is authoritative and still enforces
 * the real rule per event — standard events require the entitlement, a
 * clan-vs-clan event admits any accepted participant's admins — so a lapsed or
 * free group can never manage a *standard* event through this. Create stays
 * gated by `assertEventsEntitlement` (the host commits a paid tier up front).
 */
async function assertCanManageEvent(groupId: EventGroupId) {
  const user = await getUser();
  if (!user) throw new Error("Forbidden: sign in required.");
  if (groupId == null) {
    if (!user.is_superadmin) {
      throw new Error("Forbidden: global events are managed by site staff.");
    }
    return user;
  }
  if (!canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
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

export async function createGroupEvent(groupId: EventGroupId, input: Omit<EventInput, "group_id">) {
  // Create is the host's commitment: require the paid tier up front (the
  // backend enforces this too). Ongoing management uses assertCanManageEvent
  // so a challenged, non-subscriber opponent can co-manage.
  await assertEventsEntitlement(groupId);
  const parsed = EventInputSchema.parse({ ...input, group_id: groupId });
  const result = await api.createEvent(parsed);
  revalidatePath(eventsIndexPath(groupId));
  return { ok: true as const, id: result.id };
}

/** Event kinds annotated with `creatable` for the viewer + group — powers
 * the create form's format picker (web43a). */
export async function fetchEventKinds(groupId: EventGroupId) {
  await assertCanManageEvent(groupId);
  return api.eventKinds(groupId);
}

/** Re-read the full event detail (admin view) — used to refresh manager state
 * after a bulk change like random-populate. */
export async function reloadGroupEvent(groupId: EventGroupId, eventId: number) {
  await assertCanManageEvent(groupId);
  return api.eventForAdmin(eventId);
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
      | "submission_policy"
      | "bonus_line_points"
      | "bonus_blackout_points"
      | "mode"
      | "kind"
      | "leadership"
      | "visibility"
    >
  >,
) {
  await assertCanManageEvent(groupId);
  const parsed = EventInputSchema.omit({ group_id: true }).partial().parse(patch);
  const result = await api.updateEvent(eventId, parsed);
  revalidatePath(eventsIndexPath(groupId));
  revalidatePath(eventAdminPath(groupId, eventId));
  return result;
}

/** Permanently delete a draft or ended event (creator/superadmin). Returns a
 * discriminated result rather than throwing: Next redacts thrown Server Action
 * errors in production, which would turn the API's descriptive 409/422 message
 * ("end the event first", "type the name to confirm") into an opaque string. */
export async function deleteGroupEvent(
  groupId: EventGroupId,
  eventId: number,
  confirmName: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  await assertCanManageEvent(groupId);
  try {
    await api.deleteEvent(eventId, confirmName);
    revalidatePath(eventsIndexPath(groupId));
    revalidatePath(`/events/${eventId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, status: err.status, message: err.message };
    }
    throw err;
  }
}

// --- Lifecycle (Task 21) -----------------------------------------------------

/** Pre-flight the activation checks without activating (the "Check readiness"
 * button). Returns the structured blockers so the UI can list them and link to
 * the section that fixes each. */
export async function checkEventReadiness(
  groupId: EventGroupId,
  eventId: number,
): Promise<EventReadiness> {
  await assertCanManageEvent(groupId);
  return api.eventReadiness(eventId);
}

/** Explicit activation (draft -> active). Returns a discriminated result rather
 * than throwing: Next redacts thrown Server Action errors in production, which
 * would turn the API's descriptive 422/409 message into an opaque string. On
 * failure we surface the real message AND (for a 422) the structured blockers
 * so the UI can show exactly what to fix and where. */
export async function activateEvent(
  groupId: EventGroupId,
  eventId: number,
): Promise<
  | { ok: true; detail: EventDetail }
  | { ok: false; status: number; message: string; blockers: EventReadinessBlocker[] }
> {
  await assertCanManageEvent(groupId);
  try {
    const detail = await api.activateEvent(eventId);
    revalidatePath(eventsIndexPath(groupId));
    revalidatePath(eventAdminPath(groupId, eventId));
    revalidatePath(`/events/${eventId}`);
    return { ok: true, detail };
  } catch (err) {
    if (err instanceof ApiError) {
      // 422 = not ready: fetch the structured blockers so the UI can link to
      // each fix. Other statuses (e.g. 409 active-event limit) just carry the
      // message.
      let blockers: EventReadinessBlocker[] = [];
      if (err.status === 422) {
        try {
          blockers = (await api.eventReadiness(eventId)).blockers;
        } catch {
          /* readiness is best-effort; the message still explains it */
        }
      }
      return { ok: false, status: err.status, message: err.message, blockers };
    }
    throw err;
  }
}

/** Explicit end (active -> past). Final standings are announced to Discord. */
export async function endEvent(groupId: EventGroupId, eventId: number) {
  await assertCanManageEvent(groupId);
  const detail = await api.endEvent(eventId);
  revalidatePath(eventsIndexPath(groupId));
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return detail;
}

/**
 * Add one task to an event.
 *
 * Returns `{ ok: false, error }` for backend validation problems (e.g. "not
 * in the item database") instead of throwing: production Next.js redacts
 * thrown server-action errors to an opaque string, so a throw would reach the
 * form as a useless generic message.
 *
 * Deliberately no `revalidatePath`: EventManager owns the task list in client
 * state (`onAdded`/`onSaved`), and revalidating would re-render the whole
 * group-admin layout inside the action response — its `api.group()` call
 * takes multiple seconds on large groups, which kept the picker's buttons
 * locked for ~5s per add. Fresh navigations refetch the event anyway
 * (`api.eventForAdmin` is uncached).
 */
export async function addEventTask(
  groupId: EventGroupId,
  eventId: number,
  input: EventTaskInput,
): Promise<
  { ok: true; id: number; visibility?: "public" | "private" } | { ok: false; error: string }
> {
  await assertCanManageEvent(groupId);
  const parsed = EventTaskInputSchema.parse(input);
  try {
    const result = await api.addEventTask(eventId, parsed);
    return { ok: true as const, id: result.id, visibility: result.visibility };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false as const, error: err.message };
    throw err;
  }
}

export async function removeEventTask(groupId: EventGroupId, eventId: number, taskId: number) {
  await assertCanManageEvent(groupId);
  await api.deleteEventTask(eventId, taskId);
  return { ok: true as const };
}

export async function addEventTeam(groupId: EventGroupId, eventId: number, input: EventTeamInput) {
  await assertCanManageEvent(groupId);
  const parsed = EventTeamInputSchema.parse(input);
  const result = await api.addEventTeam(eventId, parsed);
  revalidatePath(eventAdminPath(groupId, eventId));
  return { ok: true as const, id: result.id };
}

/** Edit team cosmetics — rename and/or set the accent color (null clears
 * back to the palette default). A clan-vs-clan team's clan is fixed. */
export async function updateEventTeam(
  groupId: EventGroupId,
  eventId: number,
  teamId: number,
  patch: EventTeamPatch,
) {
  await assertCanManageEvent(groupId);
  const parsed = EventTeamPatchSchema.parse(patch);
  await api.updateEventTeam(eventId, teamId, parsed);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const };
}

/** Delete a mistakenly-created team and everything scoped to it (roster,
 * progress, ledger). Blocked server-side once the event is over. */
export async function deleteEventTeam(groupId: EventGroupId, eventId: number, teamId: number) {
  await assertCanManageEvent(groupId);
  await api.deleteEventTeam(eventId, teamId);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const };
}

/** Admin roster add — also moves a player already on another team in this
 * event (their join timestamp, the credit cutoff, resets on the new team). */
export async function addEventTeamMember(
  groupId: EventGroupId,
  eventId: number,
  teamId: number,
  playerId: number,
) {
  await assertCanManageEvent(groupId);
  await api.addEventTeamMember(eventId, teamId, playerId);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const };
}

/** Bulk roster add — "paste your team": a list of RSNs resolved server-side
 * against tracked players; returns per-name outcomes (added / skipped with a
 * reason). Never moves a player already placed on a team in this event. */
export async function bulkAddEventTeamMembers(
  groupId: EventGroupId,
  eventId: number,
  teamId: number,
  names: string[],
) {
  await assertCanManageEvent(groupId);
  const result = await api.bulkAddEventTeamMembers(eventId, teamId, names);
  if (result.added.length) {
    revalidatePath(eventAdminPath(groupId, eventId));
    revalidatePath(`/events/${eventId}`);
  }
  return result;
}

export async function removeEventTeamMember(
  groupId: EventGroupId,
  eventId: number,
  teamId: number,
  playerId: number,
) {
  await assertCanManageEvent(groupId);
  await api.removeEventTeamMember(eventId, teamId, playerId);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const };
}

/** Search players across every accepted participant clan (clan-vs-clan roster
 * picker). Falls back to the host group for standard events. */
export async function searchParticipantPlayers(
  groupId: EventGroupId,
  _eventId: number,
  participantGroupIds: number[],
  q: string,
) {
  await assertCanManageEvent(groupId);
  const trimmed = q.trim();
  if (!trimmed) return [];
  if (groupId == null) {
    const res = await api.adminLookup(trimmed);
    return res.results
      .filter((r) => r.category === "player")
      .map((r) => ({ id: Number(r.id), name: r.label }))
      .filter((p) => Number.isFinite(p.id));
  }
  const gids = participantGroupIds.length ? participantGroupIds : [groupId];
  const seen = new Set<number>();
  const out: { id: number; name: string }[] = [];
  for (const gid of gids) {
    const page = await api.groupMembers(gid, 1, trimmed);
    for (const m of page.members) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        out.push({ id: m.id, name: m.name });
      }
    }
  }
  return out;
}

/** Search players for the roster add-player picker (standard/global events). */
export async function searchGroupPlayers(groupId: EventGroupId, q: string) {
  return searchParticipantPlayers(groupId, 0, groupId != null ? [groupId] : [], q);
}

// --- Clan-vs-clan participants (Plan B) ------------------------------------

export async function listEventParticipants(
  groupId: EventGroupId,
  eventId: number,
): Promise<EventParticipant[]> {
  await assertCanManageEvent(groupId);
  return api.eventParticipants(eventId);
}

export async function inviteEventParticipant(
  groupId: EventGroupId,
  eventId: number,
  opponentGroupId: number,
) {
  await assertCanManageEvent(groupId);
  await api.inviteEventParticipant(eventId, opponentGroupId);
  revalidatePath(eventAdminPath(groupId, eventId));
  return { ok: true as const };
}

export async function acceptEventInvitation(
  groupId: EventGroupId,
  eventId: number,
  invitedGroupId: number,
  opts?: { createDiscordEvent?: boolean },
) {
  // Accepting clan admin — no events entitlement required on their side.
  const user = await getUser();
  if (!user) throw new Error("Forbidden: sign in required.");
  if (!canAdminGroup(user, invitedGroupId) && !user.is_superadmin) {
    throw new Error("Forbidden: you do not administer that clan.");
  }
  await api.acceptEventInvitation(eventId, invitedGroupId, opts);
  revalidatePath(eventsIndexPath(groupId));
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const };
}

export async function declineEventInvitation(
  groupId: EventGroupId,
  eventId: number,
  invitedGroupId: number,
) {
  const user = await getUser();
  if (!user) throw new Error("Forbidden: sign in required.");
  if (!canAdminGroup(user, invitedGroupId) && !user.is_superadmin) {
    throw new Error("Forbidden: you do not administer that clan.");
  }
  await api.declineEventInvitation(eventId, invitedGroupId);
  revalidatePath(eventsIndexPath(groupId));
  return { ok: true as const };
}

export async function removeEventParticipant(
  groupId: EventGroupId,
  eventId: number,
  participantGroupId: number,
) {
  await assertCanManageEvent(groupId);
  await api.removeEventParticipant(eventId, participantGroupId);
  revalidatePath(eventAdminPath(groupId, eventId));
  return { ok: true as const };
}

/** Search opponent clans by name for the invite picker. */
export async function searchOpponentClans(groupId: EventGroupId, q: string) {
  await assertCanManageEvent(groupId);
  if (!q.trim()) return [];
  const results = await api.search(q.trim());
  return results.groups.filter((g) => g.id !== groupId);
}

// --- Bingo designer (Task 20) ------------------------------------------------

/** Replace the event's whole bingo board. Returns the refreshed event detail
 * (the PUT may create/delete tasks, so the manager's task list changes too).
 * The API answers 409 once the event has started. */
export async function saveEventBingo(
  groupId: EventGroupId,
  eventId: number,
  input: BingoBoardInput,
) {
  await assertCanManageEvent(groupId);
  const parsed = BingoBoardInputSchema.parse(input);
  await api.saveEventBingo(eventId, parsed);
  const detail = await api.eventForAdmin(eventId);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return detail;
}

// --- Board game (web44a) -------------------------------------------------

/** The whole board (tiles + settings + positions) for the designer/manager. */
export async function fetchEventBoard(groupId: EventGroupId, eventId: number) {
  await assertCanManageEvent(groupId);
  return api.eventBoard(eventId);
}

/** Replace the tile layout (the board designer's autosave). */
export async function saveEventBoard(
  groupId: EventGroupId,
  eventId: number,
  input: BoardInput,
) {
  await assertCanManageEvent(groupId);
  const parsed = BoardInputSchema.parse(input);
  const board = await api.saveEventBoard(eventId, parsed);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return board;
}

/** Procedurally generate a whole board (art + tile track) from the boardgen
 * engine. Draft-only; replaces the current layout + background. */
export async function generateEventBoard(
  groupId: EventGroupId,
  eventId: number,
  params: {
    seed?: number | null;
    regions?: number;
    tiles?: number;
    style?: "path" | "filled";
    title?: string;
    subtitle?: string;
    watermark?: string | null;
  },
) {
  await assertCanManageEvent(groupId);
  const board = await api.generateEventBoard(eventId, params);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return board;
}

/** Merge board settings (movement/dice, rendering, coins, mercy, shop…). */
export async function saveEventBoardSettings(
  groupId: EventGroupId,
  eventId: number,
  patch: Record<string, unknown>,
) {
  await assertCanManageEvent(groupId);
  const settings = await api.patchEventBoardSettings(eventId, patch);
  revalidatePath(eventAdminPath(groupId, eventId));
  return settings;
}

/** Read the per-event shop config (refresh cadence + per-item overrides). */
export async function fetchBoardShopConfig(groupId: EventGroupId, eventId: number) {
  await assertCanManageEvent(groupId);
  return api.eventBoardShopConfig(eventId);
}

/** Save the per-event shop config (per-item overrides). Refresh cadence is
 * persisted separately via saveEventBoardSettings by the caller. */
export async function saveBoardShopConfig(
  groupId: EventGroupId,
  eventId: number,
  payload: BoardShopConfigInput,
) {
  await assertCanManageEvent(groupId);
  const parsed = BoardShopConfigInputSchema.parse(payload);
  const config = await api.putEventBoardShopConfig(eventId, parsed);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return config;
}

/** Upload a custom board background image. */
export async function uploadEventBoardBackground(
  groupId: EventGroupId,
  eventId: number,
  form: FormData,
) {
  await assertCanManageEvent(groupId);
  const res = await api.uploadEventBoardBackground(eventId, form);
  revalidatePath(eventAdminPath(groupId, eventId));
  return res;
}

/** Manual dice roll (admin rolling on a team's behalf from the manager). */
export async function rollEventBoard(
  groupId: EventGroupId,
  eventId: number,
  teamId?: number,
) {
  await assertCanManageEvent(groupId);
  const res = await api.rollEventBoard(eventId, teamId);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return res;
}

/** Search the curated task-preset library for the designer picker. */
export async function searchEventTaskLibrary(
  groupId: EventGroupId,
  params: { query?: string; type?: string; page?: number } = {},
) {
  await assertCanManageEvent(groupId);
  return api.eventTaskLibrary(params);
}

/** Item-name autocomplete for the task form. */
export async function searchEventItems(groupId: EventGroupId, q: string) {
  await assertCanManageEvent(groupId);
  return api.searchEventItems(q.trim());
}

/** NPC-name autocomplete for the task form. */
export async function searchEventNpcs(groupId: EventGroupId, q: string) {
  await assertCanManageEvent(groupId);
  return api.searchEventNpcs(q.trim());
}

/** Batch exact-name → game-id lookup — icon hydration for the task form's
 * selection chips when editing a task that only stores names. */
export async function resolveEventMetaNames(
  groupId: EventGroupId,
  kind: "item" | "npc",
  names: string[],
) {
  await assertCanManageEvent(groupId);
  return api.resolveEventMeta(kind, names);
}

// --- Verification queue & manual actions (Task 18) --------------------------

/** Admin-only completion ledger read (used by the Review section refresh). */
export async function listEventCompletions(
  groupId: EventGroupId,
  eventId: number,
  params: { status?: string; teamId?: number; taskId?: number } = {},
) {
  await assertCanManageEvent(groupId);
  return api.eventCompletions(eventId, params);
}

export async function confirmEventCompletion(
  groupId: EventGroupId,
  eventId: number,
  completionId: number,
) {
  await assertCanManageEvent(groupId);
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
  await assertCanManageEvent(groupId);
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
  await assertCanManageEvent(groupId);
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
  await assertCanManageEvent(groupId);
  const parsed = EventRevokeInputSchema.parse(input);
  await api.revokeEventCompletion(eventId, parsed);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const };
}

// --- Discord destinations (Task 19) ----------------------------------------

/** The event's Discord destination config (guild + per-kind channels), plus
 * the `messages` verbosity/live-leaderboard knobs — always returned fully
 * merged with the server defaults. */
export async function getEventDiscord(
  groupId: EventGroupId,
  eventId: number,
  scopeGroupId?: number | null,
) {
  await assertCanManageEvent(groupId);
  return api.eventDiscord(eventId, scopeGroupId ?? null);
}

/** Every guild the bot is in, for the guild picker (bot Redis cache). */
export async function listEventDiscordGuilds(groupId: EventGroupId) {
  await assertCanManageEvent(groupId);
  return api.eventDiscordGuilds();
}

/** Text channels of one guild — works for any guild the bot is in, so events
 * can target dedicated event servers. Stale ⇒ manual-id fallback in the UI. */
export async function listEventDiscordChannels(groupId: EventGroupId, guildId: string) {
  await assertCanManageEvent(groupId);
  return api.eventDiscordChannels(guildId);
}

/** Roles of one guild, for the event ping-role pickers (same cache pipeline
 * as the channel list; stale ⇒ retry shortly). */
export async function listEventDiscordRoles(groupId: EventGroupId, guildId: string) {
  await assertCanManageEvent(groupId);
  return api.eventDiscordRoles(guildId);
}

/** Replace the event's Discord destination; `guild_id: null` clears it. An
 * optional `messages` object (verbosity toggles, task-progress mode, live
 * leaderboard) saves alongside; absent = stored value left unchanged. */
export async function saveEventDiscord(
  groupId: EventGroupId,
  eventId: number,
  input: EventChannelConfigInput,
) {
  await assertCanManageEvent(groupId);
  const parsed = EventChannelConfigInputSchema.parse(input);
  const result = await api.updateEventDiscord(eventId, parsed);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`${eventAdminPath(groupId, eventId)}/discord`);
  return result;
}

// --- Per-team Discord channels & roles (web53a) ------------------------------

/** One scope of the team-discord config + live per-team provisioning state. */
export async function getEventTeamDiscord(
  groupId: EventGroupId,
  eventId: number,
  scopeGroupId?: number | null,
) {
  await assertCanManageEvent(groupId);
  return api.eventTeamDiscord(eventId, scopeGroupId ?? null);
}

/** Save one scope of the team-discord config (toggles, forum target,
 * retention, per-team on/off). The bot provisions within ~30s. */
export async function saveEventTeamDiscord(
  groupId: EventGroupId,
  eventId: number,
  input: EventTeamDiscordInput,
) {
  await assertCanManageEvent(groupId);
  const parsed = EventTeamDiscordInputSchema.parse(input);
  const result = await api.updateEventTeamDiscord(eventId, parsed);
  revalidatePath(eventAdminPath(groupId, eventId));
  return result;
}

/** Admin-side save of one team's channel notification toggles. (Captains use
 * the public event page, which calls the API with their own session.) */
export async function saveTeamNotifications(
  groupId: EventGroupId,
  eventId: number,
  teamId: number,
  input: { toggles?: Record<string, boolean>; task_progress?: "off" | "milestones" | "all" },
) {
  await assertCanManageEvent(groupId);
  return api.updateTeamNotifications(eventId, teamId, input);
}

/** Per-task edits (requires_confirmation toggle, points, label, target…).
 * No revalidatePath — same reasoning as addEventTask (client-owned state). */
export async function updateEventTask(
  groupId: EventGroupId,
  eventId: number,
  taskId: number,
  patch: EventTaskPatch,
) {
  await assertCanManageEvent(groupId);
  const parsed = EventTaskPatchSchema.parse(patch);
  return api.updateEventTask(eventId, taskId, parsed);
}

// --- Event templates (save/rerun events) ------------------------------------

/** Snapshot this event's structure as a reusable template. */
export async function saveEventTemplate(
  groupId: EventGroupId,
  eventId: number,
  input: EventTemplateSaveInput,
) {
  await assertCanManageEvent(groupId);
  const parsed = EventTemplateSaveInputSchema.parse(input);
  const result = await api.saveEventTemplate(eventId, parsed);
  revalidatePath(eventsIndexPath(groupId));
  return { ok: true as const, id: result.id };
}

/** Templates the caller can start from (public ∪ own groups' private). */
export async function searchEventTemplates(
  groupId: EventGroupId,
  params: { query?: string; page?: number } = {},
) {
  await assertCanManageEvent(groupId);
  return api.eventTemplates(params);
}

/** Own-group templates for the management list (private + public). */
export async function listGroupEventTemplates(groupId: EventGroupId) {
  await assertCanManageEvent(groupId);
  return api.eventTemplates(groupId == null ? {} : { groupId });
}

/** Template detail + preview for the picker. */
export async function getEventTemplate(groupId: EventGroupId, templateId: number) {
  await assertCanManageEvent(groupId);
  return api.eventTemplate(templateId);
}

/** Create a fresh draft event in this group from a template. */
export async function instantiateEventTemplate(
  groupId: EventGroupId,
  templateId: number,
  input: Omit<EventTemplateInstantiateInput, "group_id">,
) {
  await assertCanManageEvent(groupId);
  const parsed = EventTemplateInstantiateInputSchema.parse({ ...input, group_id: groupId });
  const result = await api.instantiateEventTemplate(templateId, parsed);
  revalidatePath(eventsIndexPath(groupId));
  return { ok: true as const, id: result.id, skipped_tasks: result.skipped_tasks };
}

/** Rename / re-describe / re-scope a template the group owns. */
export async function updateEventTemplate(
  groupId: EventGroupId,
  templateId: number,
  patch: EventTemplatePatch,
) {
  await assertCanManageEvent(groupId);
  const parsed = EventTemplatePatchSchema.parse(patch);
  const result = await api.updateEventTemplate(templateId, parsed);
  revalidatePath(eventsIndexPath(groupId));
  return result;
}

/** Soft-delete a template the group owns. */
export async function deleteEventTemplate(groupId: EventGroupId, templateId: number) {
  await assertCanManageEvent(groupId);
  const result = await api.deleteEventTemplate(templateId);
  revalidatePath(eventsIndexPath(groupId));
  return result;
}

// --- Sign-up pool (formation_mode === "signup_pool") -------------------------

/** The sign-up pool with each player's current placement. */
export async function listEventSignups(groupId: EventGroupId, eventId: number) {
  await assertCanManageEvent(groupId);
  return api.eventSignups(eventId);
}

/** Place one signed-up player onto a team (manual sort). */
export async function assignEventSignup(
  groupId: EventGroupId,
  eventId: number,
  playerId: number,
  teamId: number,
) {
  await assertCanManageEvent(groupId);
  await api.assignEventSignup(eventId, playerId, teamId);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const };
}

/** Randomly (re)distribute the pool across teams; optional clan scope. */
export async function randomizeEventSignups(
  groupId: EventGroupId,
  eventId: number,
  clanGroupId?: number,
) {
  await assertCanManageEvent(groupId);
  const result = await api.randomizeEventSignups(eventId, clanGroupId);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return result;
}

/** Admin scale/testing tool: bulk-fill this event's teams with random active
 * members (balanced, clan-aware). Never moves or removes existing members. */
export async function populateEventRandom(
  groupId: EventGroupId,
  eventId: number,
  source: "group" | "global",
  count?: number,
) {
  await assertCanManageEvent(groupId);
  const result = await api.populateEventRandom(eventId, source, count);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return result;
}

/** Withdraw a player from the pool. */
export async function removeEventSignup(
  groupId: EventGroupId,
  eventId: number,
  playerId: number,
) {
  await assertCanManageEvent(groupId);
  await api.removeEventSignup(eventId, playerId);
  revalidatePath(eventAdminPath(groupId, eventId));
  revalidatePath(`/events/${eventId}`);
  return { ok: true as const };
}

/** Post the interactive "Sign up" button to the event's Discord channel. */
export async function postEventSignupMessage(groupId: EventGroupId, eventId: number) {
  await assertCanManageEvent(groupId);
  await api.postEventSignupMessage(eventId);
  return { ok: true as const };
}

// --- Prize pot: buy-ins & donations (web52a) ---------------------------------

/** The event's prize pot (admin view: every row + notes). */
export async function fetchEventPot(
  groupId: EventGroupId,
  eventId: number,
): Promise<EventPrizePot> {
  await assertCanManageEvent(groupId);
  return api.eventPot(eventId);
}

/** Record a buy-in or donation. */
export async function recordEventBuyin(
  groupId: EventGroupId,
  eventId: number,
  input: {
    player_id?: number | null;
    rsn?: string | null;
    team_id?: number | null;
    kind?: EventBuyinKind;
    amount: number;
    status?: "pledged" | "paid";
    note?: string | null;
  },
): Promise<{ ok: true; id: number } | { ok: false; message: string }> {
  await assertCanManageEvent(groupId);
  try {
    const result = await api.recordBuyin(eventId, input);
    revalidatePath(`/events/${eventId}`);
    return { ok: true, id: result.id };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Edit a buy-in (amount / note) or flip its paid state — the roster "tick". */
export async function updateEventBuyin(
  groupId: EventGroupId,
  eventId: number,
  buyinId: number,
  patch: { amount?: number; status?: EventBuyinStatus; note?: string | null },
): Promise<{ ok: true } | { ok: false; message: string }> {
  await assertCanManageEvent(groupId);
  try {
    await api.updateBuyin(eventId, buyinId, patch);
    revalidatePath(`/events/${eventId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Remove a buy-in (soft-void once paid, else hard delete). */
export async function deleteEventBuyin(
  groupId: EventGroupId,
  eventId: number,
  buyinId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await assertCanManageEvent(groupId);
  try {
    await api.deleteBuyin(eventId, buyinId);
    revalidatePath(`/events/${eventId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Seed one pledged buy-in per member at the default buy-in (optionally one team). */
export async function bulkSeedEventBuyins(
  groupId: EventGroupId,
  eventId: number,
  teamId?: number | null,
): Promise<{ ok: true; created: number } | { ok: false; message: string }> {
  await assertCanManageEvent(groupId);
  try {
    const r = await api.bulkSeedBuyins(eventId, teamId);
    revalidatePath(`/events/${eventId}`);
    return { ok: true, created: r.created };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Post the current pot to the event's Discord announcements channel now. */
export async function announceEventPot(
  groupId: EventGroupId,
  eventId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await assertCanManageEvent(groupId);
  try {
    await api.announcePot(eventId);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Toggle the pot and/or merge its config. Disabling an event that already has
 * recorded buy-ins returns `{ needsConfirm, count, total }` (the backend's 409
 * `buyins-present`) so the UI can confirm before retrying with the flag. */
export async function updateEventPotConfig(
  groupId: EventGroupId,
  eventId: number,
  input: {
    buyins_enabled?: boolean;
    confirm_disable_buyins?: boolean;
    prize_config?: {
      default_buyin?: number;
      distribution?: EventPrizeDistribution;
      top_n?: number;
      splits?: number[];
      advertise?: boolean;
      show_contributors?: boolean;
      allow_leader_mark?: boolean;
    };
  },
): Promise<
  | { ok: true; event: EventDetail }
  | { ok: false; needsConfirm: true; count: number; total: number }
  | { ok: false; needsConfirm?: false; message: string }
> {
  await assertCanManageEvent(groupId);
  try {
    const event = await api.updateEventPotConfig(eventId, input);
    revalidatePath(eventAdminPath(groupId, eventId));
    revalidatePath(`/events/${eventId}`);
    return { ok: true, event };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409 && err.problem?.type === "buyins-present") {
        return {
          ok: false,
          needsConfirm: true,
          count: Number(err.problem.count ?? 0),
          total: Number(err.problem.total ?? 0),
        };
      }
      return { ok: false, message: err.message };
    }
    throw err;
  }
}
