"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { EventDetail, EventSignup, EventTeam } from "@droptracker/api-types";
import { getErrorMessage } from "@/lib/errors";
import { Alert, EmptyState } from "@/components/ui";
import {
  assignEventSignup,
  listEventSignups,
  postEventSignupMessage,
  randomizeEventSignups,
  removeEventSignup,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-2 py-1 text-sm outline-none";

/**
 * Admin sign-up tools shown on the event manager:
 *  - "Post sign-up button to Discord" for any self-sign-up event.
 *  - The sign-up pool (formation_mode === "signup_pool"): everyone who opted
 *    in, with manual team assignment, a Randomize button (re-roll as often as
 *    you like), and withdrawal.
 */
export function EventSignupTools({
  groupId,
  event,
  teams,
}: {
  groupId: number | null;
  event: EventDetail;
  teams: EventTeam[];
}) {
  const selfSignup =
    event.formation_mode === "self_join" ||
    event.formation_mode === "auto_assign" ||
    event.formation_mode === "signup_pool";
  const isPool = event.formation_mode === "signup_pool";
  const clanVsClan = event.mode === "clan_vs_clan";

  const [pool, setPool] = useState<EventSignup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    if (!isPool) return;
    listEventSignups(groupId, event.id)
      .then(setPool)
      .catch((err) => setError(getErrorMessage(err, "Couldn't load the sign-up pool.")));
  }, [groupId, event.id, isPool]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!selfSignup) return null;

  const teamsForRow = (row: EventSignup) =>
    clanVsClan ? teams.filter((t) => t.group_id === row.group_id) : teams;

  const onAssign = (playerId: number, teamId: number) => {
    setError(null);
    startTransition(async () => {
      try {
        await assignEventSignup(groupId, event.id, playerId, teamId);
        setPool((prev) =>
          (prev ?? []).map((r) => (r.player_id === playerId ? { ...r, team_id: teamId } : r)),
        );
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't assign the player."));
      }
    });
  };

  const onRandomize = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await randomizeEventSignups(groupId, event.id);
        setNotice(
          `Shuffled ${res.assigned} player${res.assigned === 1 ? "" : "s"} into teams` +
            (res.unassigned ? ` (${res.unassigned} had no team for their clan)` : "") +
            ".",
        );
        refresh();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't randomize teams."));
      }
    });
  };

  const onRemove = (playerId: number) => {
    setError(null);
    startTransition(async () => {
      try {
        await removeEventSignup(groupId, event.id, playerId);
        setPool((prev) => (prev ?? []).filter((r) => r.player_id !== playerId));
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't withdraw the player."));
      }
    });
  };

  const onPostDiscord = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        await postEventSignupMessage(groupId, event.id);
        setNotice("Posted a Sign up button to the event's Discord announcements channel.");
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't post to Discord — is the announcements channel set?"));
      }
    });
  };

  const unassigned = (pool ?? []).filter((r) => r.team_id == null).length;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="heading-rule text-osrs-gold pb-1 text-lg font-semibold">Sign-ups</h3>
        <button
          onClick={onPostDiscord}
          disabled={pending}
          className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright rounded border px-3 py-1.5 text-sm disabled:opacity-50"
          title="Post an interactive Sign up button to this event's Discord announcements channel"
        >
          Post sign-up to Discord
        </button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {!isPool && (
        <p className="text-osrs-parchment-dark/60 text-sm">
          Players sign up from the event page
          {event.formation_mode === "self_join"
            ? " and pick their own team."
            : " and are auto-assigned to a team."}{" "}
          Switch this event to the <strong>sign-up pool</strong> mode if you&apos;d rather collect
          sign-ups and build the teams yourself.
        </p>
      )}

      {isPool && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onRandomize}
              disabled={pending || !(pool && pool.length) || teams.length === 0}
              className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              title="Randomly distribute everyone in the pool across the teams — re-roll as often as you like"
            >
              🎲 Randomize teams
            </button>
            <span className="text-osrs-parchment-dark/60 text-xs">
              {pool == null
                ? "Loading…"
                : `${pool.length} signed up · ${unassigned} unassigned`}
            </span>
            {teams.length === 0 && (
              <span className="text-osrs-red/80 text-xs">Create teams first.</span>
            )}
          </div>

          {pool && pool.length > 0 ? (
            <ul className="divide-osrs-bronze/15 divide-y">
              {pool.map((row) => {
                const options = teamsForRow(row);
                return (
                  <li
                    key={row.player_id}
                    className="flex items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      {row.player_name}
                      {row.group_name && (
                        <span className="text-osrs-parchment-dark/50 ml-2 text-xs">
                          {row.group_name}
                        </span>
                      )}
                      {row.source === "discord" && (
                        <span className="text-osrs-parchment-dark/40 ml-2 text-xs">via Discord</span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <select
                        value={row.team_id ?? ""}
                        onChange={(e) =>
                          e.target.value && onAssign(row.player_id, Number(e.target.value))
                        }
                        disabled={pending || options.length === 0}
                        className={field}
                      >
                        <option value="">Unassigned</option>
                        {options.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => onRemove(row.player_id)}
                        disabled={pending}
                        className="text-osrs-red hover:bg-osrs-red/10 rounded px-2 py-1 text-xs disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="No sign-ups yet"
              hint="Players can sign up from the event page, or post a Sign up button to Discord."
            />
          )}
        </div>
      )}
    </section>
  );
}
