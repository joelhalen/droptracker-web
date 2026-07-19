"use client";

/**
 * Loot Sweep live board (v2 — nested groups). An icon-first "collection race":
 * per set, each team is a row of the boss's item icons — greyed-out until
 * obtained, full-colour with a ×count badge once received, and the points each
 * is worth beneath. Items WRAP within the card (no horizontal scroll); in a
 * meta-set (Barrows, Dagannoth Kings) they're clustered by sub-group. Ranked by
 * set total, the viewer's team highlighted.
 *
 * Realtime: refetches on any scoring frame on the event SSE scope (the payload
 * is small; a refetch is always consistent — the board-game pattern).
 */

import { useCallback, useState, useTransition } from "react";
import type {
  LootSweepConfigItem,
  LootSweepBoard,
  LootSweepSet,
  LootSweepTeamItem,
  RealtimeEvent,
} from "@droptracker/api-types";
import { fetchEventLootSweep } from "@/app/(site)/(public)/events/[id]/actions";
import { ItemDbIcon } from "@/components/item-db-icon";
import { useEventStream } from "@/lib/use-event-stream";

const REFETCH_KINDS = new Set(["loot_sweep", "revoke", "completion", "progress"]);

function fmt(n: number): string {
  return n.toLocaleString();
}

/** One item — icon + received/max + points. `prog` absent = preview (no team).
 * `bonus` = a scoring extra (pet / mega-rare) that doesn't gate the set. */
function ItemCell({
  def,
  prog,
  bonus,
}: {
  def: LootSweepConfigItem;
  prog?: LootSweepTeamItem;
  bonus: boolean;
}) {
  const count = prog?.count ?? 0;
  const obtained = count > 0;
  const isPet = def.source === "pet";
  const maxAwards = def.max_awards ?? 5 * (def.awards_per_tier ?? 1);
  const shownPts = obtained ? (prog?.points ?? 0) : def.points;
  const perTier = def.awards_per_tier ?? 1;
  const title =
    `${def.item_name}${isPet ? " (pet)" : bonus ? " (bonus — doesn't count toward the set)" : ""} — ` +
    (obtained
      ? `${count} received, ${fmt(prog?.points ?? 0)} pts (${prog?.scored ?? 0}/${maxAwards} score)`
      : `worth ${def.points} each, up to ${maxAwards}${perTier > 1 ? ` (full points ×${perTier} at a time)` : ""}`);
  return (
    <div
      title={title}
      className={`relative flex w-[54px] shrink-0 flex-col items-center gap-0.5 rounded-md p-1 ${
        obtained ? "bg-osrs-gold/10" : ""
      } ${bonus ? "ring-osrs-gold/40 bg-osrs-gold/[0.03] ring-1" : ""}`}
    >
      <ItemDbIcon itemId={def.item_id} size={40} className={obtained ? "" : "opacity-25 grayscale"} />
      {/* received / max — the key "how many of a possible N" */}
      <span
        className={`text-[11px] font-semibold leading-none tabular-nums ${
          obtained ? "text-osrs-gold-bright" : "text-osrs-parchment-dark/40"
        }`}
      >
        {count}
        <span className="text-osrs-parchment-dark/40 font-normal">/{maxAwards}</span>
      </span>
      <span
        className={`text-[10px] leading-none ${obtained ? "text-osrs-gold/80" : "text-osrs-parchment-dark/30"}`}
      >
        {fmt(shownPts)} pts
      </span>
    </div>
  );
}

/** A group's items as a wrapping cluster, optionally labelled (meta-sets). */
function GroupCluster({
  group,
  teamGroup,
  showLabel,
}: {
  group: LootSweepSet["groups"][number];
  teamGroup: LootSweepSet["teams"][number]["groups"][number] | undefined;
  showLabel: boolean;
}) {
  const items = group.items.map((it, ii) => ({ it, ii }));
  const setItems = items.filter(({ it }) => it.counts_for_group !== false);
  const bonusItems = items.filter(({ it }) => it.counts_for_group === false);
  return (
    <div className="flex flex-col gap-1">
      {showLabel && (
        <span
          className="text-osrs-parchment-dark/50 max-w-[15rem] truncate text-[11px] font-medium"
          title={`${group.label ?? ""}${group.npcs.length ? ` — ${group.npcs.join(", ")}` : ""}${
            group.bonus_points ? ` · +${group.bonus_points} for the set` : ""
          }`}
        >
          {group.label || group.npcs[0] || "—"}
          {teamGroup && teamGroup.awarded > 0 && <span className="text-osrs-green ml-1">✓</span>}
        </span>
      )}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        {setItems.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {setItems.map(({ it, ii }) => (
              <ItemCell key={ii} def={it} prog={teamGroup?.items[ii]} bonus={false} />
            ))}
          </div>
        )}
        {bonusItems.length > 0 && (
          <div className="border-osrs-gold/20 flex flex-col gap-0.5 border-l pl-2">
            <span
              className="text-osrs-gold/60 text-[9px] font-medium uppercase tracking-wider"
              title="Bonus points — these score but don't count toward completing the set"
            >
              bonus
            </span>
            <div className="flex flex-wrap gap-1">
              {bonusItems.map(({ it, ii }) => (
                <ItemCell key={ii} def={it} prog={teamGroup?.items[ii]} bonus={true} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SetCard({
  set,
  teamMeta,
  viewerTeamId,
}: {
  set: LootSweepSet;
  teamMeta: Map<number, { name: string; color: string | null | undefined }>;
  viewerTeamId: number | null | undefined;
}) {
  const multiGroup = set.groups.length > 1;
  const gatingGroups = set.groups.filter((g) => g.items.some((it) => it.counts_for_group !== false)).length;
  const teams = [...set.teams].sort((a, b) => b.total - a.total);

  return (
    <div className="border-osrs-bronze/25 bg-osrs-brown-dark/30 overflow-hidden rounded-lg border">
      <div className="border-osrs-bronze/20 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <h3 className="text-osrs-gold text-base font-semibold">{set.label}</h3>
        <div className="text-osrs-parchment-dark/60 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {set.set_bonus_points > 0 && (
            <span className="text-osrs-gold-bright">
              Full-set bonus {fmt(set.set_bonus_points)}
              {set.set_bonus_max > 1 ? ` ×${set.set_bonus_max}` : ""}
            </span>
          )}
          <span>−{set.decay_percent}% / tier</span>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="px-4 py-3">
          <p className="text-osrs-parchment-dark/40 mb-2.5 text-xs">
            No teams yet — each team&apos;s progress appears here once teams are added. The
            set&apos;s items:
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {set.groups.map((g, gi) => (
              <GroupCluster key={gi} group={g} teamGroup={undefined} showLabel={multiGroup} />
            ))}
          </div>
        </div>
      ) : (
        <ul className="divide-osrs-bronze/10 divide-y">
          {teams.map((team, rank) => {
            const meta = teamMeta.get(team.team_id);
            const mine = viewerTeamId != null && team.team_id === viewerTeamId;
            const groupsDone = team.groups.filter((g) => g.awarded > 0).length;
            return (
              <li
                key={team.team_id}
                className={`flex items-start gap-3 px-4 py-3 ${mine ? "bg-osrs-gold/5" : ""}`}
              >
                <div className="flex w-28 shrink-0 items-center gap-1.5 pt-2">
                  <span className="text-osrs-parchment-dark/40 w-4 text-right text-xs">{rank + 1}</span>
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: meta?.color ?? "#c8a165" }}
                  />
                  <span
                    className={`min-w-0 truncate text-sm ${mine ? "text-osrs-gold-bright font-semibold" : "text-osrs-parchment"}`}
                    title={meta?.name}
                  >
                    {meta?.name ?? `Team ${team.team_id}`}
                  </span>
                </div>

                <div className="flex min-w-0 flex-1 flex-wrap gap-x-6 gap-y-3">
                  {set.groups.map((g, gi) => (
                    <GroupCluster key={gi} group={g} teamGroup={team.groups[gi]} showLabel={multiGroup} />
                  ))}
                </div>

                <div className="flex w-16 shrink-0 flex-col items-end pt-1.5">
                  {team.set_awarded > 0 ? (
                    <span
                      className="text-osrs-green text-xs font-semibold"
                      title={`Full set complete${team.set_total ? ` · +${fmt(team.set_total)}` : ""}`}
                    >
                      ✓ set
                    </span>
                  ) : multiGroup ? (
                    <span
                      className="text-osrs-parchment-dark/50 text-xs"
                      title={`${groupsDone}/${gatingGroups} groups complete`}
                    >
                      {groupsDone}/{gatingGroups}
                    </span>
                  ) : null}
                  <span className="text-osrs-gold text-lg font-bold tabular-nums leading-tight">
                    {fmt(team.total)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function LootSweepBoard({
  eventId,
  initial,
  live,
  viewerTeamId,
}: {
  eventId: number;
  initial: LootSweepBoard;
  live: boolean;
  viewerTeamId?: number | null;
}) {
  const [board, setBoard] = useState<LootSweepBoard>(initial);
  const [, startTransition] = useTransition();

  const refetch = useCallback(() => {
    startTransition(async () => {
      try {
        setBoard(await fetchEventLootSweep(eventId));
      } catch {
        /* keep the last good board */
      }
    });
  }, [eventId]);

  const onFrame = useCallback(
    (frame: RealtimeEvent) => {
      if (frame.type !== "event_update") return;
      const kind = (frame.data as { kind?: string }).kind;
      if (kind && REFETCH_KINDS.has(kind)) refetch();
    },
    [refetch],
  );
  useEventStream(live ? [`event:${eventId}`] : [], onFrame);

  const teamMeta = new Map(board.teams.map((t) => [t.id, { name: t.name, color: t.color }]));

  if (!board.sets.length) {
    return (
      <p className="text-osrs-parchment-dark/50 text-sm">
        No Loot Sweep sets have been set up for this event yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-osrs-parchment-dark/50 text-xs">
        Each tile shows <span className="text-osrs-parchment-dark/70">received / max</span> and the
        points it&apos;s worth — greyed until obtained. Items in a{" "}
        <span className="ring-osrs-gold/40 rounded px-1 ring-1">bonus</span> column score but
        don&apos;t count toward completing the set.
      </p>
      {board.sets.map((set) => (
        <SetCard key={set.task_id} set={set} teamMeta={teamMeta} viewerTeamId={viewerTeamId} />
      ))}
    </div>
  );
}
