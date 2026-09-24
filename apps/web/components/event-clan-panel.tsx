"use client";

import { useState, useTransition } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EventDetail, EventMember, EventTeam } from "@droptracker/api-types";
import { getErrorMessage } from "@/lib/errors";
import { rosterSizeText } from "@/lib/events";
import { Alert, Button, Card, Input } from "@/components/ui";
import { EventDiscordSettings } from "@/components/event-discord";
import { EventMemberList } from "@/components/event-member-list";
import { EventSignupTools } from "@/components/event-signup-tools";
import { LocalTime } from "@/components/local-time";
import { PlayerAddInput } from "@/components/player-add-input";
import {
  addEventTeamMember,
  bulkAddEventTeamMembers,
  removeEventTeamMember,
  searchParticipantPlayers,
  updateEventTeam,
  withdrawEventParticipant,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";
import {
  assignTeamLeadership,
  removeTeamLeadership,
} from "@/app/(site)/(public)/events/[id]/actions";

type Tab = "roster" | "signups" | "discord";

const ROLE_LABEL: Record<NonNullable<EventMember["role"]>, string> = {
  leader: "Leader",
  co_leader: "Co-leader",
};

/**
 * A clan's side of a staff-hosted (global) clan-vs-clan event (web119a).
 *
 * DropTracker staff own the event itself: tasks, schedule, scoring. This panel
 * is everything a participating clan's leaders control: who plays (picked from
 * the clan's own sign-ups, within staff's per-clan limits), the team's name
 * and look, its leaders, and the clan's own Discord channels. The backend
 * scopes every call to this clan's team.
 */
export function EventClanPanel({ groupId, event }: { groupId: number; event: EventDetail }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("roster");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const team: EventTeam | undefined = event.teams.find((t) => t.group_id === groupId);
  const members = team?.members ?? [];
  const count = team?.member_count ?? members.length;
  const min = event.clan_roster_min ?? null;
  const max = event.clan_roster_max ?? null;
  const size = rosterSizeText(min, max);
  const locked =
    event.status === "past" ||
    (event.status === "active" && (event.clan_roster_locked_at_start ?? true));
  const full = max != null && count >= max;
  const short = min != null && count < min;
  const leadershipOn = event.leadership.enabled;

  const run = (fn: () => Promise<unknown>, fallback: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError(getErrorMessage(err, fallback));
      }
    });
  };

  const [teamName, setTeamName] = useState(team?.name ?? "");
  const [chatTag, setChatTag] = useState(team?.short_tag ?? "");

  if (!team) {
    return (
      <Card>
        <p className="text-osrs-parchment-dark/70 text-sm">
          Your clan doesn&apos;t have a team on this event. Accept the invite first, or ask
          DropTracker staff if something looks wrong.
        </p>
      </Card>
    );
  }

  const withdraw = () => {
    if (!window.confirm("Withdraw your clan? Your team, roster and sign-ups will be removed.")) {
      return;
    }
    run(() => withdrawEventParticipant(event.id, groupId), "Couldn't withdraw.");
  };

  return (
    <div className="max-w-3xl min-w-0 space-y-6">
      <header className="space-y-1">
        <Link
          href={`/groups/${groupId}/events` as Route}
          className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm"
        >
          ← Back to events
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-osrs-gold text-xl font-bold">{event.name}</h2>
          <span className="bg-osrs-gold/15 text-osrs-gold rounded px-1.5 py-0.5 text-xs">
            Global event
          </span>
          <span className="text-osrs-parchment-dark/60 text-xs uppercase">{event.status}</span>
        </div>
        <p className="text-osrs-parchment-dark/70 text-sm">
          DropTracker staff run this event. You pick who plays for your clan, your team&apos;s
          leaders, and where messages go in your Discord.{" "}
          <Link
            href={`/events/${event.id}` as Route}
            className="text-osrs-gold-bright hover:underline"
          >
            See the tasks and standings →
          </Link>
        </p>
      </header>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Roster meter */}
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm">
            <span className="text-osrs-parchment text-2xl font-semibold tabular-nums">{count}</span>
            <span className="text-osrs-parchment-dark/70 ml-2">
              {count === 1 ? "player" : "players"} on your roster
              {size ? ` (needs ${size})` : ""}
            </span>
          </p>
          {event.starts_at != null && event.status === "draft" && (
            <span className="text-osrs-parchment-dark/60 text-xs">
              Starts <LocalTime unix={event.starts_at} />
            </span>
          )}
        </div>
        {short && event.status === "draft" && (
          <p className="text-osrs-ember mt-2 text-sm">
            Add {min! - count} more {min! - count === 1 ? "player" : "players"} before the start, or
            your clan will be left out.
          </p>
        )}
        {full && !locked && (
          <p className="text-osrs-parchment-dark/60 mt-2 text-xs">
            Your roster is full. Remove someone to make room.
          </p>
        )}
        {locked && (
          <p className="text-osrs-parchment-dark/60 mt-2 text-xs">
            Rosters are locked now that the event has started. Ask DropTracker staff if a change is
            needed.
          </p>
        )}
      </Card>

      <div className="border-osrs-bronze/30 flex gap-1 border-b" role="tablist">
        {(
          [
            ["roster", "Roster"],
            ["signups", "Sign-ups"],
            ["discord", "Discord"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === key
                ? "border-osrs-gold text-osrs-gold"
                : "text-osrs-parchment-dark/70 hover:text-osrs-gold-bright border-transparent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "roster" && (
        <div className="space-y-6">
          {/* Team look */}
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  updateEventTeam(groupId, event.id, team.id, {
                    name: teamName.trim(),
                    short_tag: chatTag.trim() || null,
                  }),
                "Couldn't save the team.",
              );
            }}
          >
            <label className="text-osrs-parchment-dark/70 min-w-0 flex-1 text-xs">
              Team name
              <Input
                fieldSize="sm"
                value={teamName}
                maxLength={80}
                onChange={(e) => setTeamName(e.target.value)}
                className="mt-1 w-full"
              />
            </label>
            <label className="text-osrs-parchment-dark/70 text-xs">
              In-game chat tag
              <Input
                fieldSize="sm"
                value={chatTag}
                maxLength={8}
                placeholder={team.chat_tag ?? ""}
                onChange={(e) => setChatTag(e.target.value)}
                className="mt-1 block w-28"
              />
            </label>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={pending || !teamName.trim()}
            >
              Save
            </Button>
          </form>

          {!locked && (
            <div>
              <PlayerAddInput
                placeholder={
                  full ? "Roster is full" : "Add clan members — type a name, or paste a list…"
                }
                disabled={pending || full}
                existingIds={members.map((m) => m.player_id)}
                search={async (q) => searchParticipantPlayers(groupId, event.id, [groupId], q)}
                onPick={(p) =>
                  run(
                    () => addEventTeamMember(groupId, event.id, team.id, p.id),
                    "Couldn't add that player.",
                  )
                }
                onBulkAdd={async (names) => {
                  const res = await bulkAddEventTeamMembers(groupId, event.id, team.id, names);
                  router.refresh();
                  return res;
                }}
              />
            </div>
          )}

          <EventMemberList
            members={members}
            emptyLabel="Nobody on your roster yet. Pick players from the Sign-ups tab or add them above."
            listClassName="divide-osrs-bronze/10 divide-y"
            renderRow={(m: EventMember) => (
              <li
                key={m.player_id}
                className="flex items-center justify-between gap-2 py-1.5 text-sm"
              >
                <span className="min-w-0 truncate">
                  {m.player_name}
                  {m.role && (
                    <span className="text-osrs-gold ml-2 text-xs">{ROLE_LABEL[m.role]}</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs">
                  {leadershipOn && m.role == null && (
                    <button
                      onClick={() =>
                        run(
                          () => assignTeamLeadership(event.id, team.id, m.player_id, "leader"),
                          "Couldn't set the leader.",
                        )
                      }
                      disabled={pending}
                      className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright disabled:opacity-50"
                    >
                      Make leader
                    </button>
                  )}
                  {leadershipOn && m.role == null && event.leadership.co_leaders && (
                    <button
                      onClick={() =>
                        run(
                          () => assignTeamLeadership(event.id, team.id, m.player_id, "co_leader"),
                          "Couldn't set the co-leader.",
                        )
                      }
                      disabled={pending}
                      className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright disabled:opacity-50"
                    >
                      Make co-leader
                    </button>
                  )}
                  {leadershipOn && m.role != null && (
                    <button
                      onClick={() =>
                        run(
                          () => removeTeamLeadership(event.id, team.id, m.player_id),
                          "Couldn't remove the role.",
                        )
                      }
                      disabled={pending}
                      className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright disabled:opacity-50"
                    >
                      Remove role
                    </button>
                  )}
                  {!locked && (
                    <button
                      onClick={() =>
                        run(
                          () => removeEventTeamMember(groupId, event.id, team.id, m.player_id),
                          "Couldn't remove that player.",
                        )
                      }
                      disabled={pending}
                      className="text-osrs-red hover:bg-osrs-red/10 rounded px-2 py-1 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </span>
              </li>
            )}
          />

          {event.status === "draft" && (
            <div className="border-osrs-bronze/20 border-t pt-4">
              <button
                onClick={withdraw}
                disabled={pending}
                className="text-osrs-parchment-dark/60 hover:text-osrs-red text-xs disabled:opacity-50"
              >
                Withdraw your clan from this event
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "signups" && (
        <EventSignupTools groupId={groupId} event={event} teams={[team]} clanScopeId={groupId} />
      )}

      {tab === "discord" && (
        <EventDiscordSettings groupId={groupId} eventId={event.id} lockedScope={groupId} />
      )}
    </div>
  );
}
