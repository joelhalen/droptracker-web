"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EventDetail } from "@droptracker/api-types";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";
import { joinEvent, leaveEvent } from "@/app/(public)/events/[id]/actions";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-2 text-sm outline-none";

type LinkedPlayer = { id: number; name: string };

/**
 * Public join panel (Task 16): lets a signed-in user put one of their linked
 * players on a team, per the event's formation mode (events-prd.md D4).
 * Ownership/eligibility/join-code rules are enforced by the Web API; this
 * panel only guides the happy path.
 */
export function EventJoinPanel({
  event,
  players,
}: {
  event: EventDetail;
  players: LinkedPlayer[] | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Which of the viewer's players are already on a team (derived from the
  // public roster; the API's viewer block agrees but isn't cached with ISR).
  const memberships = useMemo(() => {
    const mine = new Map<number, { teamId: number; teamName: string }>();
    for (const team of event.teams) {
      for (const m of team.members ?? []) {
        if (players?.some((p) => p.id === m.player_id)) {
          mine.set(m.player_id, { teamId: team.id, teamName: team.name });
        }
      }
    }
    return mine;
  }, [event.teams, players]);

  const freePlayers = (players ?? []).filter((p) => !memberships.has(p.id));

  const [playerChoice, setPlayerChoice] = useState<number | "">("");
  const [teamId, setTeamId] = useState<number | "">(event.teams[0]?.id ?? "");
  const [joinCode, setJoinCode] = useState("");
  // The roster refreshes under us after joins/leaves; fall back to the first
  // still-free player when the chosen one is no longer available.
  const playerId = freePlayers.some((p) => p.id === playerChoice)
    ? playerChoice
    : (freePlayers[0]?.id ?? "");

  if (event.status === "past") return null;

  const selfJoin = event.formation_mode === "self_join";
  const autoAssign = event.formation_mode === "auto_assign";

  if (!selfJoin && !autoAssign && memberships.size === 0) {
    return (
      <p className="text-osrs-parchment-dark/60 text-sm">
        Teams for this event are assigned by the event admins.
      </p>
    );
  }

  if (!players) {
    return (
      <p className="text-osrs-parchment-dark/70 text-sm">
        <Link
          href={`/api/auth/login?redirect=${encodeURIComponent(`/events/${event.id}`)}`}
          className="text-osrs-gold-bright hover:underline"
        >
          Sign in
        </Link>{" "}
        to join this event.
      </p>
    );
  }

  if (players.length === 0) {
    return (
      <p className="text-osrs-parchment-dark/60 text-sm">
        Link an OSRS account to your profile to join this event.
      </p>
    );
  }

  const onJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerId === "") return;
    setError(null);
    startTransition(async () => {
      try {
        await joinEvent(event.id, {
          player_id: playerId,
          ...(selfJoin && teamId !== "" ? { team_id: teamId } : {}),
          ...(event.join_requires_code && joinCode ? { join_code: joinCode } : {}),
        });
        router.refresh();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't join the event. Please try again."));
      }
    });
  };

  const onLeave = (pid: number) => {
    setError(null);
    startTransition(async () => {
      try {
        await leaveEvent(event.id, pid);
        router.refresh();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't leave the event. Please try again."));
      }
    });
  };

  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}

      {[...memberships.entries()].map(([pid, m]) => {
        const player = players.find((p) => p.id === pid);
        return (
          <div
            key={pid}
            className="border-osrs-bronze/20 flex items-center justify-between rounded border px-3 py-2 text-sm"
          >
            <span>
              <span className="text-osrs-gold-bright">{player?.name ?? `Player ${pid}`}</span>
              <span className="text-osrs-parchment-dark/60"> is on {m.teamName}</span>
            </span>
            <button
              onClick={() => onLeave(pid)}
              disabled={pending}
              className="text-osrs-red hover:bg-osrs-red/10 rounded px-2 py-1 text-xs disabled:opacity-50"
            >
              Leave
            </button>
          </div>
        );
      })}

      {(selfJoin || autoAssign) && freePlayers.length > 0 && (
        <form onSubmit={onJoin} className="space-y-2">
          <label className="block text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Player</span>
            <select
              value={playerId}
              onChange={(e) => setPlayerChoice(e.target.value ? Number(e.target.value) : "")}
              className={`${field} w-full`}
            >
              {freePlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          {selfJoin && event.teams.length > 1 && (
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Team</span>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : "")}
                className={`${field} w-full`}
              >
                {event.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.member_count} players)
                  </option>
                ))}
              </select>
            </label>
          )}

          {autoAssign && (
            <p className="text-osrs-parchment-dark/50 text-xs">
              You&apos;ll be placed on a team automatically to keep sides balanced.
            </p>
          )}

          {event.join_requires_code && (
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Join code</span>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Code from your event admin"
                className={`${field} w-full`}
              />
            </label>
          )}

          <button
            type="submit"
            disabled={pending || playerId === "" || (event.join_requires_code && !joinCode.trim())}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark w-full rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Joining…" : "Join event"}
          </button>
        </form>
      )}
    </div>
  );
}
