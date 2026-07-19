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
  const filled = Math.min(count, maxAwards);
  return (
    <div
      title={title}
      className={`relative flex w-[50px] shrink-0 flex-col items-center gap-0.5 rounded-md px-0.5 pb-1 pt-0.5 ${
        obtained ? "bg-osrs-gold/10" : ""
      } ${bonus ? "ring-osrs-gold/40 bg-osrs-gold/[0.03] ring-1" : ""}`}
    >
      {/* points it's worth — centered above the icon */}
      <span
        className={`text-[10px] font-medium leading-none tabular-nums ${
          obtained ? "text-osrs-gold-bright" : "text-osrs-parchment-dark/45"
        }`}
      >
        {fmt(shownPts)}
      </span>
      <ItemDbIcon itemId={def.item_id} size={38} className={obtained ? "" : "opacity-25 grayscale"} />
      {/* one tab per allowed receipt; filled for each one obtained */}
      <div className="flex max-w-[44px] flex-wrap justify-center gap-[2px]" aria-label={`${count} of ${maxAwards} received`}>
        {Array.from({ length: maxAwards }).map((_, i) => (
          <span
            key={i}
            className={`h-1 w-[4px] rounded-[1px] ${i < filled ? "bg-osrs-gold-bright" : "bg-osrs-stone/40"}`}
          />
        ))}
      </div>
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
  const img = group.image_url || (group.npc_id != null ? `/img/npcdb/${group.npc_id}.png` : null);
  return (
    <div className="flex flex-col gap-1">
      {showLabel && (
        <div
          className="text-osrs-parchment-dark/60 flex max-w-[15rem] items-center gap-1.5 text-[11px] font-medium"
          title={`${group.label ?? ""}${group.npcs.length ? ` — ${group.npcs.join(", ")}` : ""}${
            group.bonus_points ? ` · +${group.bonus_points} for the set` : ""
          }`}
        >
          {img && (
            <img
              src={img}
              alt=""
              className="h-5 w-5 shrink-0 object-contain"
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
            />
          )}
          <span className="truncate">{group.label || group.npcs[0] || "—"}</span>
          {teamGroup && teamGroup.awarded > 0 && <span className="text-osrs-green">✓</span>}
        </div>
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

/** A "bonus" section — the scoring extras that don't gate the set. */
function BonusColumn({
  items,
  teamGroup,
}: {
  items: { it: LootSweepConfigItem; ii: number }[];
  teamGroup: LootSweepSet["teams"][number]["groups"][number] | undefined;
}) {
  if (items.length === 0) return null;
  return (
    <div className="border-osrs-gold/20 flex shrink-0 flex-col gap-0.5 self-stretch border-l pl-3">
      <span
        className="text-osrs-gold/60 text-[9px] font-medium uppercase tracking-wider"
        title="Bonus points — these score but don't count toward completing the set"
      >
        bonus
      </span>
      <div className="flex flex-wrap gap-1">
        {items.map(({ it, ii }) => (
          <ItemCell key={ii} def={it} prog={teamGroup?.items[ii]} bonus />
        ))}
      </div>
    </div>
  );
}

/** The item area of a team row. Single-group sets fill the set items on the
 * left and pin the bonus column to the RIGHT so it lands in the same spot on
 * every set; meta-sets keep their per-group clusters. */
function TeamItems({
  set,
  teamGroups,
  multiGroup,
}: {
  set: LootSweepSet;
  teamGroups: LootSweepSet["teams"][number]["groups"] | undefined;
  multiGroup: boolean;
}) {
  if (multiGroup) {
    return (
      <div className="flex min-w-0 flex-1 flex-wrap gap-x-6 gap-y-3">
        {set.groups.map((g, gi) => (
          <GroupCluster key={gi} group={g} teamGroup={teamGroups?.[gi]} showLabel />
        ))}
      </div>
    );
  }
  const g = set.groups[0];
  if (!g) return <div className="flex-1" />;
  const tg = teamGroups?.[0];
  const indexed = g.items.map((it, ii) => ({ it, ii }));
  const setItems = indexed.filter(({ it }) => it.counts_for_group !== false);
  const bonusItems = indexed.filter(({ it }) => it.counts_for_group === false);
  return (
    <>
      <div className="flex min-w-0 flex-1 flex-wrap content-start gap-1">
        {setItems.map(({ it, ii }) => (
          <ItemCell key={ii} def={it} prog={tg?.items[ii]} bonus={false} />
        ))}
      </div>
      <BonusColumn items={bonusItems} teamGroup={tg} />
    </>
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

  const rows =
    teams.length === 0 ? (
      <div className="px-4 py-3">
        <p className="text-osrs-parchment-dark/40 mb-2.5 text-xs">
          No teams yet — each team&apos;s progress appears here once teams are added. The set&apos;s
          items:
        </p>
        <div className="flex items-start">
          <TeamItems set={set} teamGroups={undefined} multiGroup={multiGroup} />
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

              <TeamItems set={set} teamGroups={team.groups} multiGroup={multiGroup} />

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
    );

  // Full-width card: a header bar (boss art + name + full-set bonus) with the
  // team rows spanning the whole width beneath. Single-boss sets show the
  // boss's image; meta-sets carry their sub-boss art inside the clusters.
  const single = multiGroup ? null : set.groups[0];
  const headerImg = single
    ? single.image_url || (single.npc_id != null ? `/img/npcdb/${single.npc_id}.png` : null)
    : null;
  const headerBonus = single ? single.bonus_points : set.set_bonus_points;
  const headerBonusMax = single ? single.bonus_max : set.set_bonus_max;
  return (
    <div className="border-osrs-bronze/25 bg-osrs-brown-dark/30 overflow-hidden rounded-lg border">
      <div className="border-osrs-bronze/20 flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2.5">
        {headerImg && (
          <img
            src={headerImg}
            alt=""
            className="h-9 w-9 shrink-0 object-contain"
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
          />
        )}
        <h3 className="text-osrs-gold text-base font-semibold">{set.label}</h3>
        <div className="text-osrs-parchment-dark/60 ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {headerBonus > 0 && (
            <span className="text-osrs-gold-bright">
              Full-set bonus {fmt(headerBonus)}
              {headerBonusMax > 1 ? ` ×${headerBonusMax}` : ""}
            </span>
          )}
          <span>−{set.decay_percent}% / tier</span>
        </div>
      </div>
      {rows}
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
      <div className="border-osrs-bronze/25 bg-osrs-brown-dark/20 rounded-lg border p-4 text-sm">
        <p className="text-osrs-parchment/90 leading-relaxed">
          Race to collect drops from bosses across the game. Every item is worth points the first
          time your team receives it, and a little less each time after — so spreading out across
          many bosses beats farming one. Complete <em>all</em> of a boss&apos;s items and your team
          banks its full-set bonus on top.
        </p>
        <p className="text-osrs-parchment-dark/70 mt-2 leading-relaxed">
          Each tile is one drop: the <span className="text-osrs-gold-bright">number above</span> is
          the points it&apos;s worth, and the <span className="text-osrs-gold-bright">little bars</span>{" "}
          below fill in — one per receipt — up to the max that can score. Tiles stay greyed until
          you&apos;ve pulled the drop. Items in a{" "}
          <span className="ring-osrs-gold/40 rounded px-1 ring-1">bonus</span> section still score
          but aren&apos;t needed to complete the set (pets, mega-rares).
        </p>
      </div>
      {board.sets.map((set) => (
        <SetCard key={set.task_id} set={set} teamMeta={teamMeta} viewerTeamId={viewerTeamId} />
      ))}
    </div>
  );
}
