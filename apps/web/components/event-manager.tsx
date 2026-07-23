"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
import type { EventParticipant } from "@droptracker/api-types";
import {
  EVENT_FORMATION_MODES,
  EVENT_SUBMISSION_POLICIES,
  type EventDetail,
  type EventReadiness,
  type EventTask,
  type EventTeam,
  type EventTeamBulkAddResult,
} from "@droptracker/api-types";
import {
  FORMATION_MODE_LABELS,
  EVENT_MODE_LABELS,
  SUBMISSION_POLICY_HELP,
  SUBMISSION_POLICY_LABELS,
  TASK_TYPE_LABELS,
  TEAM_COLORS,
  taskGoal,
  teamColorMap,
} from "@/lib/events";
import { getErrorMessage } from "@/lib/errors";
import { Alert, EmptyState } from "@/components/ui";
import {
  activateEvent,
  checkEventReadiness,
  addEventTeam,
  addEventTeamMember,
  bulkAddEventTeamMembers,
  deleteEventTeam,
  deleteGroupEvent,
  endEvent,
  listEventParticipants,
  populateEventRandom,
  reloadGroupEvent,
  removeEventTask,
  removeEventTeamMember,
  searchParticipantPlayers,
  updateEventTask,
  updateEventTeam,
  updateGroupEvent,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";
import { PlayerAddInput } from "@/components/player-add-input";
import { EventBingoDesigner } from "@/components/event-bingo-designer";
import { EventBoardDesigner } from "@/components/event-board-designer";
import { EventBoardShopConfig } from "@/components/event-board-shop-config";
import { EventDiscordSettings } from "@/components/event-discord";
import { PrizePotManager } from "@/components/prize-pot-manager";
import { EventMemberList } from "@/components/event-member-list";
import { EventParticipantsPanel } from "@/components/event-participants-panel";
import { formatProgressValue, taskThreshold } from "@/components/event-task-progress";
import { EventSignupTools } from "@/components/event-signup-tools";
import { EventTaskForm } from "@/components/event-task-form";
import { EventTaskLibraryPicker } from "@/components/event-task-library-picker";
import { EventTemplateSaver } from "@/components/event-template-saver";
import { EventReview } from "@/components/event-review";
import { EventAuditLog } from "@/components/event-audit-log";
import { LocalTime, TimezoneNote } from "@/components/local-time";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-2 text-sm outline-none";

/** Convert a datetime-local value to unix seconds (or null). */
const toUnix = (v: string): number | null => (v ? Math.floor(new Date(v).getTime() / 1000) : null);
/** Convert unix seconds to a datetime-local value (or ""). */
const fromUnix = (v: number | null): string => {
  if (!v) return "";
  const d = new Date(v * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Colored draft/active/past chip (explicit lifecycle, Task 21). */
function StatusChip({ status }: { status: EventDetail["status"] }) {
  const styles: Record<EventDetail["status"], string> = {
    draft: "bg-osrs-bronze/20 text-osrs-parchment-dark/80",
    active: "bg-green-500/15 text-green-400",
    past: "bg-osrs-brown-dark/60 text-osrs-parchment-dark/50",
  };
  return (
    <span
      className={`${styles[status]} rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide`}
    >
      {status}
    </span>
  );
}

/** The manager's tabbed sections (web48a UX pass): everything that used to be
 * one endless scroll — including the Discord settings that lived on their own
 * page — now sits behind one tab bar under the always-visible header. */
const MANAGER_TABS = [
  { key: "tasks", label: "Tasks" },
  { key: "teams", label: "Teams" },
  { key: "board", label: "Board" },
  { key: "prizes", label: "Prize Pot" },
  { key: "discord", label: "Discord" },
  { key: "review", label: "Review" },
  { key: "audit", label: "Audit" },
] as const;
type ManagerTab = (typeof MANAGER_TABS)[number]["key"];

/** Maps a readiness blocker's `target` to the manager tab that fixes it, so
 * the "Fix →" link jumps straight there. `dates` has no tab (the schedule is
 * edited from the header form), so it gets no jump. */
const READINESS_TARGET_TAB: Record<string, ManagerTab | undefined> = {
  teams: "teams",
  board: "board",
  tasks: "tasks",
};

/** The activation pre-flight result: a green "ready" note, or the list of
 * blockers each with a "Fix →" link to the manager section that resolves it. */
function ReadinessPanel({
  readiness,
  onGoto,
  onDismiss,
}: {
  readiness: EventReadiness;
  onGoto: (target: string) => void;
  onDismiss: () => void;
}) {
  if (readiness.ready) {
    return (
      <div className="rounded border border-green-600/40 bg-green-900/10 p-3 text-sm">
        <p className="font-semibold text-green-400">✓ Ready to start</p>
        <p className="text-osrs-parchment-dark/70">
          {readiness.auto_start && readiness.starts_at != null ? (
            <>
              All checks pass — this event will auto-activate at{" "}
              <LocalTime unix={readiness.starts_at} />.
            </>
          ) : (
            "All checks pass — you can activate it now."
          )}
        </p>
      </div>
    );
  }
  return (
    <div className="border-osrs-red/40 bg-osrs-red/5 space-y-2 rounded border p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-osrs-red font-semibold">
          Not ready yet — {readiness.blockers.length}{" "}
          {readiness.blockers.length === 1 ? "thing" : "things"} to fix
          {readiness.auto_start && readiness.starts_at != null
            ? " before it's due to start"
            : ""}
          :
        </p>
        <button
          onClick={onDismiss}
          className="text-osrs-parchment-dark/50 hover:text-osrs-gold-bright shrink-0 text-xs"
        >
          Dismiss
        </button>
      </div>
      <ul className="space-y-1.5">
        {readiness.blockers.map((b) => (
          <li key={b.code} className="flex items-start justify-between gap-3">
            <span className="text-osrs-parchment-dark/80">• {b.message}</span>
            {READINESS_TARGET_TAB[b.target] && (
              <button
                onClick={() => onGoto(b.target)}
                className="text-osrs-gold-bright shrink-0 whitespace-nowrap text-xs hover:underline"
              >
                Fix in {READINESS_TARGET_TAB[b.target]} →
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** `groupId` is null for global events (superadmin-managed from /admin/events). */
export function EventManager({
  groupId,
  event: initialEvent,
}: {
  groupId: number | null;
  event: EventDetail;
}) {
  const [event, setEvent] = useState(initialEvent);
  const [tasks, setTasks] = useState<EventTask[]>(initialEvent.tasks);
  const [teams, setTeams] = useState<EventTeam[]>(initialEvent.teams);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [tab, setTab] = useState<ManagerTab>("tasks");
  const router = useRouter();
  // Delete flow: the type-to-confirm modal is open when non-null; the string
  // is what the admin has typed so far (must match the event name to enable).
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const applyDetail = (detail: EventDetail) => {
    setEvent(detail);
    setTasks(detail.tasks);
    setTeams(detail.teams);
  };

  // The readiness pre-flight result (the "Check readiness" button, or the
  // structured blockers a failed activation returns). null = not shown.
  const [readiness, setReadiness] = useState<EventReadiness | null>(null);

  /** Explicit activation — the API pre-flights readiness (teams/board/dates)
   * and the tier's active-event limit. On failure we surface the API's real
   * message plus the structured blockers (Next redacts thrown Server Action
   * errors, so the action returns a result instead of throwing). */
  const onActivate = () => {
    setError(null);
    startTransition(async () => {
      const res = await activateEvent(groupId, event.id);
      if (res.ok) {
        applyDetail(res.detail);
        setReadiness(null);
        return;
      }
      setError(res.message);
      setReadiness(
        res.blockers.length
          ? {
              status: event.status,
              ready: false,
              blockers: res.blockers,
              starts_at: event.starts_at ?? null,
              auto_start: event.starts_at != null && event.status === "draft",
              already_active: event.status !== "draft",
            }
          : null,
      );
    });
  };

  /** Pre-flight readiness without activating — lists what still needs fixing
   * (and links there) so a leader can confirm the event will be ready by its
   * start time. */
  const onCheckReadiness = () => {
    setError(null);
    startTransition(async () => {
      try {
        setReadiness(await checkEventReadiness(groupId, event.id));
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't check readiness. Please try again."));
      }
    });
  };

  const onEnd = () => {
    setConfirmingEnd(false);
    setError(null);
    startTransition(async () => {
      try {
        applyDetail(await endEvent(groupId, event.id));
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't end the event. Please try again."));
      }
    });
  };

  /** Permanently delete the event (type-to-confirm modal). On success, leave
   * the now-gone event page for the events index. The backend re-checks the
   * name and refuses live events, so a failure surfaces the real message. */
  const onDeleteEvent = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteGroupEvent(groupId, event.id, deleteConfirm ?? "");
      if (res.ok) {
        setDeleteConfirm(null);
        router.push((groupId == null ? "/admin/events" : `/groups/${groupId}/events`) as Route);
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  };

  const [editingEvent, setEditingEvent] = useState(false);
  const [eventDraft, setEventDraft] = useState({
    name: event.name,
    description: event.description ?? "",
    startsAt: fromUnix(event.starts_at),
    endsAt: fromUnix(event.ends_at),
    formationMode: event.formation_mode,
    joinCode: event.join_code ?? "",
    isPrivate: event.visibility === "private",
    requiresConfirmation: event.requires_confirmation,
    submissionPolicy: event.submission_policy,
    leadershipEnabled: event.leadership.enabled,
    coLeaders: event.leadership.co_leaders,
    leaderSelection: event.leadership.selection,
  });

  const startEditEvent = () => {
    setError(null);
    setEventDraft({
      name: event.name,
      description: event.description ?? "",
      startsAt: fromUnix(event.starts_at),
      endsAt: fromUnix(event.ends_at),
      formationMode: event.formation_mode,
      joinCode: event.join_code ?? "",
      isPrivate: event.visibility === "private",
      requiresConfirmation: event.requires_confirmation,
      submissionPolicy: event.submission_policy,
      leadershipEnabled: event.leadership.enabled,
      coLeaders: event.leadership.co_leaders,
      leaderSelection: event.leadership.selection,
    });
    setEditingEvent(true);
  };

  const saveEditEvent = () => {
    if (!eventDraft.name.trim()) return;
    startTransition(async () => {
      setError(null);
      try {
        const updated = await updateGroupEvent(groupId, event.id, {
          name: eventDraft.name,
          description: eventDraft.description || undefined,
          starts_at: toUnix(eventDraft.startsAt),
          ends_at: toUnix(eventDraft.endsAt),
          formation_mode: eventDraft.formationMode,
          join_code: eventDraft.joinCode.trim() || null,
          visibility: eventDraft.isPrivate ? "private" : "public",
          requires_confirmation: eventDraft.requiresConfirmation,
          submission_policy: eventDraft.submissionPolicy,
          leadership: {
            enabled: eventDraft.leadershipEnabled,
            co_leaders: eventDraft.coLeaders,
            selection: eventDraft.leaderSelection,
          },
        });
        setEvent(updated);
        setTasks(updated.tasks);
        setTeams(updated.teams);
        setEditingEvent(false);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't save the event. Please try again."));
      }
    });
  };

  /** Roster add (also moves a player already on another team in this event —
   * their join timestamp resets, so credit starts over on the new team). */
  const onAddMember = (teamId: number, player: { id: number; name: string }) => {
    setError(null);
    startTransition(async () => {
      try {
        await addEventTeamMember(groupId, event.id, teamId, player.id);
        const joinedAt = Math.floor(Date.now() / 1000);
        setTeams((prev) =>
          prev.map((t) => {
            const members = (t.members ?? []).filter((m) => m.player_id !== player.id);
            if (t.id === teamId) {
              members.push({ player_id: player.id, player_name: player.name, joined_at: joinedAt });
            }
            return { ...t, members, member_count: members.length };
          }),
        );
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't add the player. Please try again."));
      }
    });
  };

  /** Bulk roster add from a pasted list of names — merges the added rows
   * into team state and returns the full per-name result so the input can
   * show what was skipped and why. */
  const onBulkAddMembers = async (
    teamId: number,
    names: string[],
  ): Promise<EventTeamBulkAddResult> => {
    setError(null);
    const result = await bulkAddEventTeamMembers(groupId, event.id, teamId, names);
    if (result.added.length) {
      const joinedAt = Math.floor(Date.now() / 1000);
      setTeams((prev) =>
        prev.map((t) => {
          if (t.id !== teamId) return t;
          const members = [...(t.members ?? [])];
          for (const p of result.added) {
            if (!members.some((m) => m.player_id === p.id)) {
              members.push({ player_id: p.id, player_name: p.name, joined_at: joinedAt });
            }
          }
          return { ...t, members, member_count: members.length };
        }),
      );
    }
    return result;
  };

  const onRemoveMember = (teamId: number, playerId: number) => {
    setError(null);
    startTransition(async () => {
      try {
        await removeEventTeamMember(groupId, event.id, teamId, playerId);
        setTeams((prev) =>
          prev.map((t) => {
            if (t.id !== teamId) return t;
            const members = (t.members ?? []).filter((m) => m.player_id !== playerId);
            return { ...t, members, member_count: members.length };
          }),
        );
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't remove the player. Please try again."));
      }
    });
  };

  /** Task id being edited inline, or -1 for the create form, or null. */
  const [taskFormFor, setTaskFormFor] = useState<number | null>(null);
  /** Copy-from-library panel (mutually exclusive with the create form). */
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamGroupId, setTeamGroupId] = useState<number | "">("");
  const [participants, setParticipants] = useState<EventParticipant[]>([]);

  /** Admin scale/testing tool: bulk-fill teams with random active members. */
  const [populateSource, setPopulateSource] = useState<"group" | "global">(
    groupId == null ? "global" : "group",
  );
  const [populateCount, setPopulateCount] = useState("");
  const [populateResult, setPopulateResult] = useState<{ added: number } | null>(null);

  const onPopulateRandom = () => {
    setError(null);
    setPopulateResult(null);
    const n = populateCount.trim() ? Number(populateCount.trim()) : undefined;
    if (n !== undefined && (!Number.isInteger(n) || n <= 0)) {
      setError("Count must be a positive whole number.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await populateEventRandom(groupId, event.id, populateSource, n);
        setPopulateResult({ added: res.added });
        // Refresh the whole manager state so team rosters/counts reflect the adds.
        applyDetail(await reloadGroupEvent(groupId, event.id));
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't populate the event. Please try again."));
      }
    });
  };

  const isClanVsClan = event.mode === "clan_vs_clan";
  const acceptedParticipantIds = participants
    .filter((p) => p.status === "accepted")
    .map((p) => p.group_id);

  useEffect(() => {
    if (!isClanVsClan || groupId == null) {
      setParticipants([]);
      return;
    }
    listEventParticipants(groupId, event.id)
      .then(setParticipants)
      .catch(() => setParticipants([]));
  }, [isClanVsClan, groupId, event.id]);

  /** Per-task manual-review toggle (PRD D3). */
  const onToggleTaskReview = (t: EventTask) => {
    const next = !t.requires_confirmation;
    setTasks((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, requires_confirmation: next } : x)),
    );
    setError(null);
    startTransition(async () => {
      try {
        await updateEventTask(groupId, event.id, t.id, { requires_confirmation: next });
      } catch (err) {
        setTasks((prev) =>
          prev.map((x) => (x.id === t.id ? { ...x, requires_confirmation: !next } : x)),
        );
        setError(getErrorMessage(err, "Couldn't update the task. Please try again."));
      }
    });
  };

  /** Task id awaiting delete confirmation (destructive: erases progress). */
  const [confirmRemoveTask, setConfirmRemoveTask] = useState<number | null>(null);

  const onRemoveTask = (taskId: number) => {
    setConfirmRemoveTask(null);
    const prevTasks = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setError(null);
    startTransition(async () => {
      try {
        await removeEventTask(groupId, event.id, taskId);
      } catch (err) {
        setTasks(prevTasks);
        setError(getErrorMessage(err, "Couldn't remove the task. Please try again."));
      }
    });
  };

  const onAddTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    if (isClanVsClan && teamGroupId === "") {
      setError("Pick which clan this team represents.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const { id } = await addEventTeam(groupId, event.id, {
          name: teamName.trim(),
          ...(isClanVsClan && teamGroupId !== "" ? { group_id: teamGroupId } : {}),
        });
        setTeams((prev) => [
          ...prev,
          {
            id,
            name: teamName.trim(),
            score: 0,
            coins: 0,
            member_count: 0,
            ...(isClanVsClan && teamGroupId !== "" ? { group_id: teamGroupId } : {}),
          },
        ]);
        setTeamName("");
        setTeamGroupId("");
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't add the team. Please try again."));
      }
    });
  };

  /** Rename a team (optimistic; reverts on failure). */
  const onRenameTeam = (teamId: number, name: string) => {
    const next = name.trim();
    if (!next) return;
    const prev = teams;
    setTeams((ts) => ts.map((t) => (t.id === teamId ? { ...t, name: next } : t)));
    setError(null);
    startTransition(async () => {
      try {
        await updateEventTeam(groupId, event.id, teamId, { name: next });
      } catch (err) {
        setTeams(prev);
        setError(getErrorMessage(err, "Couldn't rename the team. Please try again."));
      }
    });
  };

  /** Set (or clear) a team's accent color (optimistic; reverts on failure). */
  const onColorTeam = (teamId: number, color: string | null) => {
    const prev = teams;
    setTeams((ts) => ts.map((t) => (t.id === teamId ? { ...t, color } : t)));
    setError(null);
    startTransition(async () => {
      try {
        await updateEventTeam(groupId, event.id, teamId, { color });
      } catch (err) {
        setTeams(prev);
        setError(getErrorMessage(err, "Couldn't recolor the team. Please try again."));
      }
    });
  };

  /** Delete a team and its roster/progress (optimistic; reverts on failure). */
  const onDeleteTeam = (teamId: number) => {
    const prev = teams;
    setTeams((ts) => ts.filter((t) => t.id !== teamId));
    setError(null);
    startTransition(async () => {
      try {
        await deleteEventTeam(groupId, event.id, teamId);
      } catch (err) {
        setTeams(prev);
        setError(getErrorMessage(err, "Couldn't delete the team. Please try again."));
      }
    });
  };

  return (
    <div className="space-y-10">
      {editingEvent ? (
        <div className="border-osrs-bronze/30 space-y-3 rounded border p-4">
          <input
            value={eventDraft.name}
            onChange={(e) => setEventDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Event name"
            className={field}
          />
          <textarea
            value={eventDraft.description}
            onChange={(e) => setEventDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Description (optional)"
            rows={2}
            className={field}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Starts</span>
              <input
                type="datetime-local"
                value={eventDraft.startsAt}
                onChange={(e) => setEventDraft((d) => ({ ...d, startsAt: e.target.value }))}
                className={field}
              />
            </label>
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Ends</span>
              <input
                type="datetime-local"
                value={eventDraft.endsAt}
                onChange={(e) => setEventDraft((d) => ({ ...d, endsAt: e.target.value }))}
                className={field}
              />
            </label>
          </div>
          <TimezoneNote className="text-osrs-parchment-dark/60 block text-xs" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Team formation</span>
              <select
                value={eventDraft.formationMode}
                onChange={(e) =>
                  setEventDraft((d) => ({
                    ...d,
                    formationMode: e.target.value as EventDetail["formation_mode"],
                  }))
                }
                className={`${field} w-full`}
              >
                {EVENT_FORMATION_MODES.map((m) => (
                  <option key={m} value={m}>
                    {FORMATION_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                Join code (self join only — blank for open signup)
              </span>
              <input
                value={eventDraft.joinCode}
                onChange={(e) => setEventDraft((d) => ({ ...d, joinCode: e.target.value }))}
                maxLength={32}
                placeholder="Optional code players must enter"
                className={`${field} w-full`}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
              Submission policy
            </span>
            <select
              value={eventDraft.submissionPolicy}
              onChange={(e) =>
                setEventDraft((d) => ({
                  ...d,
                  submissionPolicy: e.target.value as EventDetail["submission_policy"],
                }))
              }
              className={`${field} w-full`}
            >
              {EVENT_SUBMISSION_POLICIES.map((p) => (
                <option key={p} value={p}>
                  {SUBMISSION_POLICY_LABELS[p]}
                </option>
              ))}
            </select>
            <span className="text-osrs-parchment-dark/60 mt-1 block text-xs">
              {SUBMISSION_POLICY_HELP[eventDraft.submissionPolicy]}
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={eventDraft.requiresConfirmation}
              onChange={(e) =>
                setEventDraft((d) => ({ ...d, requiresConfirmation: e.target.checked }))
              }
              className="mt-0.5 size-4"
            />
            <span>
              Require manual confirmation for <em>every</em> completion
              <span className="text-osrs-parchment-dark/60 block text-xs">
                All automatic completions queue in Review until an admin confirms them. You can also
                require review per task below.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={eventDraft.isPrivate}
              onChange={(e) => setEventDraft((d) => ({ ...d, isPrivate: e.target.checked }))}
              className="mt-0.5 size-4"
            />
            <span>
              Keep this event private
              <span className="text-osrs-parchment-dark/60 block text-xs">
                Hidden from the public events list and search — only members of the
                {isClanVsClan ? " participating clans" : " group"} and event admins can see it.
              </span>
            </span>
          </label>

          {/* Team leadership (web48a): leaders hold executive authority — on
              board-game events they trigger the rolls and run the shop. */}
          <fieldset className="border-osrs-bronze/20 space-y-3 rounded border p-3">
            <legend className="text-osrs-parchment-dark/70 px-1 text-xs">Team leadership</legend>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={eventDraft.leadershipEnabled}
                onChange={(e) =>
                  setEventDraft((d) => ({ ...d, leadershipEnabled: e.target.checked }))
                }
                className="mt-0.5 size-4"
              />
              <span>
                Teams have a leader
                <span className="text-osrs-parchment-dark/60 block text-xs">
                  The leader makes the executive calls for their team — on board-game events
                  only they can trigger dice rolls and buy or use shop items.
                </span>
              </span>
            </label>
            {eventDraft.leadershipEnabled && (
              <>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={eventDraft.coLeaders}
                    onChange={(e) => setEventDraft((d) => ({ ...d, coLeaders: e.target.checked }))}
                    className="mt-0.5 size-4"
                  />
                  <span>
                    Allow a co-leader
                    <span className="text-osrs-parchment-dark/60 block text-xs">
                      Shares the leader&apos;s authority; the leader can appoint their own.
                    </span>
                  </span>
                </label>
                <label className="block text-sm sm:max-w-xs">
                  <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                    How leaders are chosen
                  </span>
                  <select
                    value={eventDraft.leaderSelection}
                    onChange={(e) =>
                      setEventDraft((d) => ({
                        ...d,
                        leaderSelection: e.target.value as "admin" | "election",
                      }))
                    }
                    className={`${field} w-full`}
                  >
                    <option value="admin">Admins assign leaders</option>
                    <option value="election">Teams elect their leader (majority vote)</option>
                  </select>
                  <span className="text-osrs-parchment-dark/60 mt-1 block text-xs">
                    Admin assignment always works as an override, either way. Members vote on
                    their team&apos;s page.
                  </span>
                </label>
              </>
            )}
          </fieldset>
          <div className="flex items-center gap-2">
            <button
              onClick={saveEditEvent}
              disabled={pending || !eventDraft.name.trim()}
              className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setEditingEvent(false)}
              disabled={pending}
              className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href={(groupId == null ? "/admin/events" : `/groups/${groupId}/events`) as Route}
                className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
              >
                ← Back to events
              </Link>
              <div className="mt-1 flex items-center gap-2">
                <h2 className="text-osrs-gold text-xl font-bold">{event.name}</h2>
                <StatusChip status={event.status} />
                {groupId == null && (
                  <span className="bg-osrs-gold/15 text-osrs-gold rounded px-1.5 py-0.5 text-xs">
                    Global
                  </span>
                )}
                {isClanVsClan && (
                  <span className="bg-osrs-gold/15 text-osrs-gold rounded px-1.5 py-0.5 text-xs">
                    {EVENT_MODE_LABELS.clan_vs_clan}
                  </span>
                )}
                {event.visibility === "private" && (
                  <span
                    className="bg-osrs-bronze/25 text-osrs-parchment-dark/80 rounded px-1.5 py-0.5 text-xs"
                    title="Only participating members and admins can see this event"
                  >
                    Private
                  </span>
                )}
              </div>
              <span className="text-osrs-parchment-dark/60 text-sm">
                {event.formation_mode.replace(/_/g, " ")}
                {event.join_requires_code ? " · join code set" : ""}
                {" · "}
                {SUBMISSION_POLICY_LABELS[event.submission_policy].toLowerCase()}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {event.status === "draft" && (
                <Link
                  href={
                    (groupId == null
                      ? `/admin/events/new?event=${event.id}`
                      : `/groups/${groupId}/events/new?event=${event.id}`) as Route
                  }
                  className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-sm"
                  title="Walk through the remaining setup step by step"
                >
                  Guided setup
                </Link>
              )}
              <button
                onClick={startEditEvent}
                className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-sm"
              >
                Edit
              </button>
              <Link
                href={`/events/${event.id}` as Route}
                className="text-osrs-gold-bright text-sm hover:underline"
              >
                View public page →
              </Link>
            </div>
          </div>

          {/* Lifecycle (Task 21): scheduled window + explicit transitions. */}
          <div className="border-osrs-bronze/20 flex flex-wrap items-center gap-x-4 gap-y-2 rounded border p-3 text-sm">
            <span className="text-osrs-parchment-dark/70">
              {event.status === "draft" &&
                (event.starts_at ? (
                  <>
                    Scheduled to start <LocalTime unix={event.starts_at} /> (auto-activates if it
                    passes the checks)
                  </>
                ) : (
                  "Draft — not scheduled; activate it manually when it's ready"
                ))}
              {event.status === "active" && (
                <>
                  Live
                  {event.activated_at && (
                    <>
                      {" since "}
                      <LocalTime unix={event.activated_at} />
                    </>
                  )}
                  {event.ends_at ? (
                    <>
                      {" · ends "}
                      <LocalTime unix={event.ends_at} />
                    </>
                  ) : (
                    " · no scheduled end"
                  )}
                </>
              )}
              {event.status === "past" && (
                <>
                  Ended
                  {event.ended_at && (
                    <>
                      {" "}
                      <LocalTime unix={event.ended_at} />
                    </>
                  )}
                </>
              )}
            </span>
            <span className="ml-auto flex items-center gap-2">
              {event.status === "draft" && (
                <>
                  <button
                    onClick={onCheckReadiness}
                    disabled={pending}
                    className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:text-osrs-gold-bright hover:border-osrs-gold/40 rounded border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                  >
                    {pending ? "Checking…" : "Check readiness"}
                  </button>
                  <button
                    onClick={onActivate}
                    disabled={pending}
                    className="bg-osrs-gold text-osrs-brown-dark hover:bg-osrs-gold-bright rounded px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                  >
                    {pending ? "Activating…" : "Activate"}
                  </button>
                </>
              )}
              {event.status === "active" &&
                (confirmingEnd ? (
                  <>
                    <span className="text-osrs-parchment-dark/70 text-xs">
                      End the event now? This can&apos;t be undone.
                    </span>
                    <button
                      onClick={onEnd}
                      disabled={pending}
                      className="bg-osrs-red/80 text-osrs-parchment hover:bg-osrs-red rounded px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                    >
                      {pending ? "Ending…" : "Yes, end it"}
                    </button>
                    <button
                      onClick={() => setConfirmingEnd(false)}
                      disabled={pending}
                      className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmingEnd(true)}
                    disabled={pending}
                    className="border-osrs-red/50 text-osrs-red hover:bg-osrs-red/10 rounded border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                  >
                    End event
                  </button>
                ))}
            </span>
          </div>

          {readiness && (
            <ReadinessPanel
              readiness={readiness}
              onGoto={(target) => {
                const t = READINESS_TARGET_TAB[target];
                if (t) setTab(t);
              }}
              onDismiss={() => setReadiness(null)}
            />
          )}

          {/* Save the event's structure for re-use ("Saving/Rerunning Events"). */}
          <div className="flex justify-end">
            <EventTemplateSaver groupId={groupId} eventId={event.id} eventName={event.name} />
          </div>

          {/* Danger zone: permanently delete the event (drafts + ended only; a
              live event must be ended first, enforced by the backend too). */}
          <div className="border-osrs-red/30 flex flex-wrap items-center justify-between gap-2 rounded border border-dashed p-3">
            <div className="text-osrs-parchment-dark/70 text-xs">
              <span className="text-osrs-red/90 font-medium">Danger zone</span> — permanently
              delete this event and all of its tasks, teams, rosters and history.
              {event.status === "active" && " End the event before it can be deleted."}
            </div>
            <button
              type="button"
              onClick={() => setDeleteConfirm("")}
              disabled={pending || event.status === "active"}
              title={
                event.status === "active"
                  ? "End the event before deleting it"
                  : "Permanently delete this event"
              }
              className="border-osrs-red/50 text-osrs-red hover:bg-osrs-red/10 rounded border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
            >
              Delete event
            </button>
          </div>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {/* Type-to-confirm delete modal (explicit confirmation). */}
      {deleteConfirm !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm event deletion"
        >
          <div className="bg-osrs-brown border-osrs-bronze/40 w-full max-w-md space-y-3 rounded-lg border p-5 shadow-xl">
            <h3 className="text-osrs-gold text-lg font-bold">Delete this event?</h3>
            <p className="text-osrs-parchment-dark/80 text-sm">
              This permanently removes{" "}
              <strong className="text-osrs-parchment">{event.name}</strong> and everything in it
              — tasks, teams, rosters, and all progress &amp; completion history. This{" "}
              <em>cannot be undone</em>.
            </p>
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                Type the event name to confirm
              </span>
              <input
                autoFocus
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={event.name}
                className={`${field} w-full`}
              />
            </label>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={pending}
                className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDeleteEvent}
                disabled={
                  pending ||
                  deleteConfirm.trim().toLowerCase() !== event.name.trim().toLowerCase()
                }
                className="bg-osrs-red/80 text-osrs-parchment hover:bg-osrs-red rounded px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabbed sections (web48a): one bar instead of an endless scroll. */}
      <div
        className="border-osrs-bronze/25 flex flex-wrap gap-1 border-b pb-px"
        role="tablist"
        aria-label="Event settings sections"
      >
        {MANAGER_TABS.filter(
          // Loot Sweep has no designable board (its board is auto-built from
          // the set tasks) — hide the bingo/board designer tab for it.
          (t) => !(t.key === "board" && event.kind === "loot_sweep"),
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px rounded-t px-3 py-2 text-sm font-medium ${
              tab === t.key
                ? "border-osrs-bronze/25 bg-osrs-brown-dark/40 text-osrs-gold border border-b-transparent"
                : "text-osrs-parchment-dark/60 hover:text-osrs-gold-bright"
            }`}
          >
            {t.key === "board" && event.kind === "board_game" ? "Game board" : t.label}
          </button>
        ))}
      </div>

      {/* Tasks */}
      <section className={tab === "tasks" ? "" : "hidden"}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="heading-rule text-osrs-gold pb-1 text-lg font-semibold">Tasks</h3>
          <span className="flex items-center gap-2">
            {!libraryOpen && (
              <button
                onClick={() => {
                  setLibraryOpen(true);
                  setTaskFormFor(null);
                }}
                className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright rounded border px-3 py-1.5 text-sm font-medium"
                title="Copy a preset, a task another clan shared publicly, or one of your clan's private saves"
              >
                From library
              </button>
            )}
            {taskFormFor !== -1 && (
              <button
                onClick={() => {
                  setTaskFormFor(-1);
                  setLibraryOpen(false);
                }}
                className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium"
              >
                New task
              </button>
            )}
          </span>
        </div>
        {libraryOpen && (
          <div className="mb-4">
            <EventTaskLibraryPicker
              groupId={groupId}
              eventId={event.id}
              onAdded={(t) => setTasks((prev) => [...prev, t])}
              onClose={() => setLibraryOpen(false)}
            />
          </div>
        )}
        {taskFormFor === -1 && (
          <div className="mb-4">
            <EventTaskForm
              groupId={groupId}
              eventId={event.id}
              onSaved={(t) => {
                setTasks((prev) => [...prev, t]);
                setTaskFormFor(null);
              }}
              onCancel={() => setTaskFormFor(null)}
            />
          </div>
        )}

        {tasks.length ? (
          <ul className="divide-osrs-bronze/20 divide-y">
            {tasks.map((t) =>
              taskFormFor === t.id ? (
                <li key={t.id} className="py-2.5">
                  <EventTaskForm
                    groupId={groupId}
                    eventId={event.id}
                    initial={t}
                    onSaved={(updated) => {
                      setTasks((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
                      setTaskFormFor(null);
                    }}
                    onCancel={() => setTaskFormFor(null)}
                  />
                </li>
              ) : (
                <li key={t.id} className="py-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span>
                      <span className="text-osrs-parchment-dark/50 mr-2 text-xs uppercase">
                        {TASK_TYPE_LABELS[t.type]}
                      </span>
                      {t.label}
                      {taskGoal(t) && (
                        <span className="text-osrs-parchment-dark/60"> — {taskGoal(t)}</span>
                      )}
                      {t.points > 0 && (
                        <span className="text-osrs-gold-bright ml-2 text-xs">{t.points} pts</span>
                      )}
                      {t.visibility === "private" && (
                        <span
                          className="border-osrs-bronze/40 text-osrs-parchment-dark/70 ml-2 rounded border px-1 text-[10px] uppercase"
                          title="Library copy saved privately — other clans can't reuse this task"
                        >
                          private
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <label
                        className="text-osrs-parchment-dark/60 flex cursor-pointer items-center gap-1 text-xs"
                        title="Completions of this task queue for admin review"
                      >
                        <input
                          type="checkbox"
                          checked={t.requires_confirmation}
                          onChange={() => onToggleTaskReview(t)}
                          disabled={pending}
                          className="size-3.5"
                        />
                        review
                      </label>
                      <button
                        onClick={() => {
                          setTaskFormFor(t.id);
                          setConfirmRemoveTask(null);
                        }}
                        className="text-osrs-parchment-dark/70 hover:bg-osrs-bronze/15 rounded px-2 py-1 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmRemoveTask(t.id)}
                        disabled={pending}
                        className="text-osrs-red hover:bg-osrs-red/10 rounded px-2 py-1 text-xs disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </span>
                  </div>
                  {confirmRemoveTask === t.id && (
                    <div className="border-osrs-red/30 bg-osrs-red/5 mt-2 rounded border p-2 text-xs">
                      <p className="text-osrs-parchment-dark/80">
                        Remove <span className="font-medium">{t.label}</span>? Progress and
                        completions for this task are erased
                        {event.has_bingo
                          ? "; any board cell it fills stays on the board, unbound, ready to be given a new task in the designer"
                          : ""}
                        . This can&apos;t be undone.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => onRemoveTask(t.id)}
                          disabled={pending}
                          className="bg-osrs-red/80 hover:bg-osrs-red text-osrs-parchment rounded px-3 py-1 text-xs font-medium disabled:opacity-50"
                        >
                          Remove task
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveTask(null)}
                          className="text-osrs-parchment-dark/70 hover:text-osrs-parchment rounded px-2 py-1 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ),
            )}
          </ul>
        ) : (
          <EmptyState title="No tasks yet" />
        )}
      </section>

      {/* Progress matrix — the admin transparency view: every task × team
          rollup at a glance (same numbers the public pages render live). */}
      {tasks.length > 0 && teams.length > 0 && (
        <section className={tab === "tasks" ? "" : "hidden"}>
          <h3 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">Progress</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="text-osrs-parchment-dark/60 text-left text-xs">
                  <th className="py-1.5 pr-3 font-normal">Task</th>
                  {teams.map((tm) => (
                    <th key={tm.id} className="px-3 py-1.5 text-right font-normal">
                      {tm.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-osrs-bronze/15 divide-y">
                {tasks.map((t) => {
                  const target = taskThreshold(t);
                  return (
                    <tr key={t.id}>
                      <td
                        className="text-osrs-parchment max-w-0 truncate py-1.5 pr-3"
                        title={t.label}
                      >
                        {t.label}
                      </td>
                      {teams.map((tm) => {
                        const p = (event.progress ?? []).find(
                          (row) => row.task_id === t.id && row.team_id === tm.id,
                        );
                        return (
                          <td key={tm.id} className="px-3 py-1.5 text-right tabular-nums">
                            {p?.completed ? (
                              <span className="text-osrs-green">✓</span>
                            ) : (
                              <span
                                className={
                                  p?.progress
                                    ? "text-osrs-parchment-dark/80"
                                    : "text-osrs-parchment-dark/30"
                                }
                              >
                                {formatProgressValue(t, p?.progress ?? 0)} /{" "}
                                {formatProgressValue(t, p?.target ?? target)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Clan-vs-clan participant roster */}
      {isClanVsClan && groupId != null && (
        <div className={tab === "teams" ? "" : "hidden"}>
          <EventParticipantsPanel
            groupId={groupId}
            eventId={event.id}
            isHost={event.group_id === groupId}
          />
        </div>
      )}

      {/* Teams */}
      <section className={tab === "teams" ? "" : "hidden"}>
        <h3 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">Teams</h3>
        {isClanVsClan && event.status === "draft" && (
          <p className="text-osrs-parchment/70 mb-3 text-sm">
            Teams are optional. Leave them empty and, when the event starts, it
            runs whole clan vs whole clan — anyone in each clan competes for it.
            Add teams only if you want to split a clan into named squads (then
            every clan needs at least one).
          </p>
        )}
        <form onSubmit={onAddTeam} className="mb-4 flex flex-wrap gap-2">
          {isClanVsClan && (
            <select
              value={teamGroupId}
              onChange={(e) => setTeamGroupId(e.target.value ? Number(e.target.value) : "")}
              className={`${field} min-w-[10rem]`}
            >
              <option value="">Clan…</option>
              {participants
                .filter((p) => p.status === "accepted")
                .map((p) => (
                  <option key={p.group_id} value={p.group_id}>
                    {p.group_name ?? `Clan ${p.group_id}`}
                  </option>
                ))}
            </select>
          )}
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Team name"
            className={`${field} min-w-[10rem] flex-1`}
          />
          <button
            type="submit"
            disabled={pending || !teamName.trim()}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Add team
          </button>
        </form>

        {/* Admin scale/testing tool: bulk-fill teams with random ACTIVE
            members, balanced across teams. Never moves or removes anyone. */}
        {teams.length > 0 && (
          <div className="border-osrs-bronze/20 bg-osrs-brown-dark/20 mb-4 rounded border border-dashed p-3">
            <p className="text-osrs-gold-bright text-sm font-medium">Randomly populate (testing)</p>
            <p className="text-osrs-parchment-dark/60 mt-0.5 mb-2 text-xs">
              Fills the teams above with randomly chosen active members, spread evenly. For
              quickly loading an event before a large-scale test.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={populateSource}
                onChange={(e) => setPopulateSource(e.target.value as "group" | "global")}
                className={`${field} min-w-[11rem]`}
                aria-label="Member source"
              >
                {groupId != null && <option value="group">This event&apos;s group members</option>}
                <option value="global">All members (global)</option>
              </select>
              <input
                value={populateCount}
                onChange={(e) => setPopulateCount(e.target.value)}
                inputMode="numeric"
                placeholder="Max to add (optional)"
                className={`${field} w-40`}
                aria-label="Maximum members to add"
              />
              <button
                type="button"
                onClick={onPopulateRandom}
                disabled={pending}
                className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright rounded border px-3 py-2 text-sm disabled:opacity-50"
              >
                {pending ? "Populating…" : "Populate"}
              </button>
              {populateResult && (
                <span className="text-osrs-green text-xs">
                  Added {populateResult.added} member{populateResult.added === 1 ? "" : "s"}.
                </span>
              )}
            </div>
          </div>
        )}

        {teams.length ? (
          <ul className="space-y-4">
            {(() => {
              const accents = teamColorMap(teams);
              return teams.map((team) => (
              <TeamRoster
                key={team.id}
                groupId={groupId}
                eventId={event.id}
                participantGroupIds={
                  isClanVsClan ? acceptedParticipantIds : groupId != null ? [groupId] : []
                }
                team={team}
                accentColor={accents.get(team.id)!}
                participants={participants}
                pending={pending}
                onAddMember={onAddMember}
                onBulkAdd={onBulkAddMembers}
                onRemoveMember={onRemoveMember}
                onRename={onRenameTeam}
                onColor={onColorTeam}
                onDelete={onDeleteTeam}
              />
              ));
            })()}
          </ul>
        ) : (
          <EmptyState title="No teams yet" />
        )}
      </section>

      {/* Board designer: dice board for board_game events (web44a), the
          bingo grid for everything else (Task 20). Loot Sweep has no
          designable board — its icon board is built from the set tasks. */}
      {event.kind === "loot_sweep" ? null : event.kind === "board_game" ? (
        <section className={tab === "board" ? "" : "hidden"}>
          <h3 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
            Game board
          </h3>
          <EventBoardDesigner groupId={groupId} event={event} tasks={tasks} />
          <div className="mt-6">
            <EventBoardShopConfig groupId={groupId} eventId={event.id} />
          </div>
        </section>
      ) : (
        <section className={tab === "board" ? "" : "hidden"}>
          <h3 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">Board</h3>
          <EventBingoDesigner
            groupId={groupId}
            event={event}
            tasks={tasks}
            onSaved={(detail) => {
              // The board PUT can create/delete tasks — refresh the whole
              // manager state from the returned detail.
              applyDetail(detail);
            }}
          />
        </section>
      )}

      {/* Self-service sign-ups: pool sorting + "post to Discord" */}
      <div className={tab === "teams" ? "" : "hidden"}>
        <EventSignupTools groupId={groupId} event={event} teams={teams} />
      </div>

      {/* Prize pot: buy-ins, donations, distribution config (web52a). */}
      <section className={tab === "prizes" ? "" : "hidden"}>
        <h3 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">Prize Pot</h3>
        <PrizePotManager
          groupId={groupId}
          event={event}
          teams={teams}
          onEventUpdated={applyDetail}
        />
      </section>

      {/* Per-event Discord config, inline (web48a — used to be its own page;
          the standalone /discord route still works for old links). */}
      <section className={tab === "discord" ? "" : "hidden"}>
        <h3 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">Discord</h3>
        <EventDiscordSettings groupId={groupId} eventId={event.id} />
      </section>

      {/* Verification queue / ledger / manual awards (Task 18) */}
      <div className={tab === "review" ? "" : "hidden"}>
        <EventReview groupId={groupId} eventId={event.id} tasks={tasks} teams={teams} />
      </div>

      {/* Full event audit log — every point + admin action, filterable (web57a) */}
      <section className={tab === "audit" ? "" : "hidden"}>
        <h3 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">Audit log</h3>
        <EventAuditLog groupId={groupId} eventId={event.id} />
      </section>
    </div>
  );
}

/** One team's roster: member list with remove, plus an add-player box with
 * live search results and pasted-list bulk add (over the group's members, or
 * all participant clans on clan-vs-clan events). */
function TeamRoster({
  groupId,
  eventId,
  participantGroupIds,
  team,
  accentColor,
  participants,
  pending,
  onAddMember,
  onBulkAdd,
  onRemoveMember,
  onRename,
  onColor,
  onDelete,
}: {
  groupId: number | null;
  eventId: number;
  participantGroupIds: number[];
  team: EventTeam;
  /** Effective accent (assigned color, else palette fallback) for the dot. */
  accentColor: string;
  participants: EventParticipant[];
  pending: boolean;
  onAddMember: (teamId: number, player: { id: number; name: string }) => void;
  onBulkAdd: (teamId: number, names: string[]) => Promise<EventTeamBulkAddResult>;
  onRemoveMember: (teamId: number, playerId: number) => void;
  onRename: (teamId: number, name: string) => void;
  onColor: (teamId: number, color: string | null) => void;
  onDelete: (teamId: number) => void;
}) {
  const members = team.members ?? [];
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(team.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickingColor, setPickingColor] = useState(false);

  const clanLabel =
    team.group_id != null
      ? (participants.find((p) => p.group_id === team.group_id)?.group_name ??
        `Clan ${team.group_id}`)
      : null;

  const searchPlayers = (q: string) => {
    const searchGids = team.group_id != null ? [team.group_id] : participantGroupIds;
    return searchParticipantPlayers(groupId, eventId, searchGids, q);
  };

  return (
    <li className="border-osrs-bronze/20 rounded border p-3">
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const next = draftName.trim();
            if (!next) return;
            if (next !== team.name) onRename(team.id, next);
            setEditing(false);
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            maxLength={80}
            autoFocus
            className={`${field} min-w-[10rem] flex-1`}
          />
          <button
            type="submit"
            disabled={pending || !draftName.trim()}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftName(team.name);
              setEditing(false);
            }}
            className="text-osrs-parchment-dark/70 hover:text-osrs-parchment rounded px-2 py-1.5 text-xs"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <button
              type="button"
              onClick={() => {
                setPickingColor((v) => !v);
                setConfirmDelete(false);
              }}
              disabled={pending}
              title="Team color"
              aria-label={`Change ${team.name}'s color`}
              className="border-osrs-bronze/40 hover:border-osrs-gold inline-block size-3.5 shrink-0 cursor-pointer rounded-full border disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            />
            {team.name}
            {clanLabel && (
              <span className="text-osrs-parchment-dark/50 ml-1 text-xs">({clanLabel})</span>
            )}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-osrs-parchment-dark/60 mr-1 text-xs">
              {members.length} players · {team.score} pts
            </span>
            <button
              type="button"
              onClick={() => {
                setDraftName(team.name);
                setEditing(true);
                setConfirmDelete(false);
              }}
              disabled={pending}
              className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright rounded px-2 py-1 text-xs disabled:opacity-50"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={pending}
              className="text-osrs-red hover:bg-osrs-red/10 rounded px-2 py-1 text-xs disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {pickingColor && !editing && (
        <div className="border-osrs-bronze/30 mt-2 flex flex-wrap items-center gap-1.5 rounded border p-2">
          {TEAM_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onColor(team.id, c);
                setPickingColor(false);
              }}
              disabled={pending}
              title={c}
              aria-label={`Set color ${c}`}
              className={`size-5 cursor-pointer rounded-full border transition-transform hover:scale-110 disabled:opacity-50 ${
                team.color === c ? "border-osrs-gold border-2" : "border-osrs-bronze/40"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <label
            className="border-osrs-bronze/40 hover:border-osrs-gold relative size-5 cursor-pointer overflow-hidden rounded-full border bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]"
            title="Custom color"
          >
            <input
              type="color"
              value={team.color ?? accentColor}
              onChange={(e) => {
                onColor(team.id, e.target.value.toLowerCase());
                setPickingColor(false);
              }}
              disabled={pending}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Pick a custom color"
            />
          </label>
          {team.color != null && (
            <button
              type="button"
              onClick={() => {
                onColor(team.id, null);
                setPickingColor(false);
              }}
              disabled={pending}
              className="text-osrs-parchment-dark/70 hover:text-osrs-parchment ml-1 rounded px-2 py-0.5 text-xs disabled:opacity-50"
            >
              Reset to default
            </button>
          )}
        </div>
      )}

      {confirmDelete && !editing && (
        <div className="border-osrs-red/30 bg-osrs-red/5 mt-2 rounded border p-2 text-xs">
          <p className="text-osrs-parchment-dark/80">
            Delete <span className="font-medium">{team.name}</span>?
            {members.length > 0 || team.score > 0 ? (
              <>
                {" "}
                This removes {members.length} member{members.length === 1 ? "" : "s"} and erases the
                team&apos;s {team.score} pts of progress. This can&apos;t be undone.
              </>
            ) : (
              <> This can&apos;t be undone.</>
            )}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirmDelete(false);
                onDelete(team.id);
              }}
              disabled={pending}
              className="bg-osrs-red/80 hover:bg-osrs-red text-osrs-parchment rounded px-3 py-1 text-xs font-medium disabled:opacity-50"
            >
              Delete team
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-osrs-parchment-dark/70 hover:text-osrs-parchment rounded px-2 py-1 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {members.length > 0 && (
        <div className="mt-2">
          <EventMemberList
            members={members}
            pageSize={8}
            unit="member"
            listClassName="divide-osrs-bronze/10 divide-y"
            renderRow={(m) => (
              <li key={m.player_id} className="flex items-center justify-between py-1.5 text-sm">
                <span>
                  {m.player_name}
                  {m.joined_at && (
                    <span className="text-osrs-parchment-dark/40 ml-2 text-xs">
                      joined {new Date(m.joined_at * 1000).toLocaleDateString()}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => onRemoveMember(team.id, m.player_id)}
                  disabled={pending}
                  className="text-osrs-red hover:bg-osrs-red/10 rounded px-2 py-1 text-xs disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            )}
          />
        </div>
      )}

      <div className="mt-2">
        <PlayerAddInput
          placeholder={
            groupId == null
              ? "Add players — type a name, or paste a list…"
              : participantGroupIds.length > 1
                ? "Add participant clan members — type a name, or paste a list…"
                : "Add group members — type a name, or paste a list…"
          }
          existingIds={members.map((m) => m.player_id)}
          disabled={pending}
          search={searchPlayers}
          onPick={(p) => onAddMember(team.id, p)}
          onBulkAdd={(names) => onBulkAdd(team.id, names)}
        />
      </div>
    </li>
  );
}
