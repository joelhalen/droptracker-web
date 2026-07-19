"use client";

/**
 * Loot Sweep live board (v2 — nested groups). An icon-first "collection race":
 * per set, item icons are greyed-out until obtained and full-colour once
 * received, with a ×count badge and scored/cap pips. Items are clustered by
 * their group (sub-set) with the group's NPC + bonus labelled; a team's row
 * shows how many groups it has completed and its running set total, ranked.
 *
 * Realtime: refetches on any scoring frame on the event SSE scope (the payload
 * is small; a refetch is always consistent — the board-game pattern).
 */

import { useCallback, useState, useTransition } from "react";
import type { LootSweepBoard, LootSweepSet, RealtimeEvent } from "@droptracker/api-types";
import { fetchEventLootSweep } from "@/app/(site)/(public)/events/[id]/actions";
import { ItemDbIcon } from "@/components/item-db-icon";
import { useEventStream } from "@/lib/use-event-stream";

const REFETCH_KINDS = new Set(["loot_sweep", "revoke", "completion", "progress"]);

function fmt(n: number): string {
  return n.toLocaleString();
}

/** One item cell within a team's strip. */
function ItemCell({
  itemId,
  name,
  count,
  scored,
  points,
  maxAwards,
  bonus,
}: {
  itemId: number | null | undefined;
  name: string;
  count: number;
  scored: number;
  points: number;
  maxAwards: number;
  bonus: boolean;
}) {
  const obtained = count > 0;
  const title = obtained
    ? `${name} — ${count} received, ${fmt(points)} pts (${scored}/${maxAwards} scored)`
    : `${name} — not obtained yet`;
  const pips = Math.min(maxAwards, 6);
  return (
    <div
      title={title}
      className={`relative flex w-12 shrink-0 flex-col items-center gap-0.5 rounded p-1 ${
        obtained ? "bg-osrs-gold/5" : ""
      } ${bonus ? "ring-osrs-gold/25 ring-1" : ""}`}
    >
      <div className="relative">
        <ItemDbIcon itemId={itemId} size={30} className={obtained ? "" : "opacity-30 grayscale"} />
        {count > 1 && (
          <span className="bg-osrs-brown-dark text-osrs-gold-bright ring-osrs-bronze/40 absolute -right-1.5 -top-1 rounded-full px-1 text-[10px] font-bold leading-tight ring-1">
            ×{count}
          </span>
        )}
      </div>
      <div className="flex h-1 gap-0.5" aria-hidden>
        {Array.from({ length: pips }).map((_, i) => (
          <span
            key={i}
            className={`h-1 w-1 rounded-full ${i < Math.min(scored, 6) ? "bg-osrs-gold" : "bg-osrs-stone/40"}`}
          />
        ))}
      </div>
    </div>
  );
}

type Col = { gi: number; ii: number; groupStart: boolean };

function SetCard({
  set,
  teamMeta,
  viewerTeamId,
}: {
  set: LootSweepSet;
  teamMeta: Map<number, { name: string; color: string | null | undefined }>;
  viewerTeamId: number | null | undefined;
}) {
  // Flatten items across groups, remembering group boundaries for dividers.
  const cols: Col[] = [];
  set.groups.forEach((g, gi) => g.items.forEach((_it, ii) => cols.push({ gi, ii, groupStart: ii === 0 })));
  const gatingGroups = set.groups.filter((g) => g.items.some((it) => it.counts_for_group !== false)).length;

  const teams = [...set.teams].sort((a, b) => b.total - a.total);
  const divider = (groupStart: boolean, gi: number) =>
    groupStart && gi > 0 ? "border-osrs-bronze/25 ml-2 border-l pl-2" : "";

  return (
    <div className="border-osrs-bronze/25 bg-osrs-brown-dark/30 overflow-hidden rounded-lg border">
      <div className="border-osrs-bronze/20 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <h3 className="text-osrs-gold font-semibold">{set.label}</h3>
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

      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* group labels */}
          <div className="border-osrs-bronze/10 flex items-end gap-2 border-b px-4 pt-2 text-[10px]">
            <span className="w-32 shrink-0" />
            {cols.map(({ gi, ii, groupStart }) => {
              const g = set.groups[gi]!;
              return (
                <div key={`${gi}-${ii}`} className={`w-12 shrink-0 ${divider(groupStart, gi)}`}>
                  {groupStart && (
                    <span
                      className="text-osrs-parchment-dark/50 block truncate"
                      title={`${g.label ?? ""}${g.npcs.length ? ` — ${g.npcs.join(", ")}` : ""}${
                        g.bonus_points ? ` · +${g.bonus_points} set` : ""
                      }`}
                    >
                      {g.label || g.npcs[0] || "—"}
                    </span>
                  )}
                </div>
              );
            })}
            <span className="w-24 shrink-0" />
          </div>

          {/* item legend */}
          <div className="border-osrs-bronze/10 flex items-end gap-2 border-b px-4 pb-2 pt-1 text-[10px]">
            <span className="w-32 shrink-0" />
            {cols.map(({ gi, ii, groupStart }) => {
              const it = set.groups[gi]!.items[ii]!;
              return (
                <div
                  key={`${gi}-${ii}`}
                  className={`flex w-12 shrink-0 flex-col items-center ${divider(groupStart, gi)}`}
                  title={`${it.item_name} — ${it.points} pts${
                    it.counts_for_group === false ? " (bonus, doesn't gate)" : ""
                  }`}
                >
                  <ItemDbIcon itemId={it.item_id} size={20} />
                  <span className="text-osrs-gold-bright mt-0.5">{it.points}</span>
                </div>
              );
            })}
            <span className="text-osrs-parchment-dark/50 w-24 shrink-0 text-right">Done · Total</span>
          </div>

          {/* team rows */}
          <ul>
            {teams.length === 0 && (
              <li className="text-osrs-parchment-dark/40 px-4 py-3 text-xs">
                No teams yet — each team&apos;s progress appears here once teams are added.
              </li>
            )}
            {teams.map((team, rank) => {
              const meta = teamMeta.get(team.team_id);
              const mine = viewerTeamId != null && team.team_id === viewerTeamId;
              const groupsDone = team.groups.filter((g) => g.awarded > 0).length;
              return (
                <li
                  key={team.team_id}
                  className={`border-osrs-bronze/10 flex items-center gap-2 border-b px-4 py-2 last:border-b-0 ${
                    mine ? "bg-osrs-gold/5" : ""
                  }`}
                >
                  <div className="flex w-32 shrink-0 items-center gap-1.5">
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

                  {cols.map(({ gi, ii, groupStart }) => {
                    const it = set.groups[gi]!.items[ii]!;
                    const ti = team.groups[gi]?.items[ii];
                    return (
                      <div key={`${gi}-${ii}`} className={divider(groupStart, gi)}>
                        <ItemCell
                          itemId={it.item_id}
                          name={it.item_name}
                          count={ti?.count ?? 0}
                          scored={ti?.scored ?? 0}
                          points={ti?.points ?? 0}
                          maxAwards={it.max_awards ?? 5 * (it.awards_per_tier ?? 1)}
                          bonus={it.counts_for_group === false}
                        />
                      </div>
                    );
                  })}

                  <div className="flex w-24 shrink-0 flex-col items-end">
                    <span
                      className={`text-xs ${
                        team.set_awarded > 0 ? "text-osrs-green font-semibold" : "text-osrs-parchment-dark/40"
                      }`}
                      title={`${groupsDone}/${gatingGroups} groups complete${
                        team.set_total ? ` · +${fmt(team.set_total)} set bonus` : ""
                      }`}
                    >
                      {team.set_awarded > 0 ? "✓ " : ""}
                      {groupsDone}/{gatingGroups}
                    </span>
                    <span className="text-osrs-gold text-sm font-bold tabular-nums">{fmt(team.total)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
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
      {board.sets.map((set) => (
        <SetCard key={set.task_id} set={set} teamMeta={teamMeta} viewerTeamId={viewerTeamId} />
      ))}
    </div>
  );
}
