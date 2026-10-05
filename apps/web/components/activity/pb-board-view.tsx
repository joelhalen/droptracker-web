"use client";

/**
 * Per-boss personal-best boards (one card per team size), pushed from the PB
 * index, a group's records, or a profile. The boards are the site's own
 * `PbBoards`, so each time expands to the gear, inventory and character model
 * it was set with, exactly as on droptracker.io.
 *
 * The clan toggle scopes to the group the board was opened from (a group's
 * records) or else to the server the Activity was launched in.
 */
import { useEffect, useState } from "react";
import type { PbBossBoard } from "@droptracker/api-types";
import { PbBoards } from "@/components/pb-boards";
import { pbBoard } from "@/lib/activity/api";
import { useActivityData } from "@/lib/activity/data-context";
import { useActivityNav } from "@/lib/activity/nav";
import { BackBar, ErrorNote, LoadingBlock } from "@/components/activity/bits";
import { npcIcon } from "@/lib/activity/img";

export function PbBoardView({
  npcId,
  bossName,
  groupId,
}: {
  npcId: number;
  bossName: string;
  /** Open scoped to this group (pushed from a group's records). */
  groupId?: number;
}) {
  const nav = useActivityNav();
  const { group } = useActivityData();
  const scopeId = groupId ?? group?.id;
  const [board, setBoard] = useState<PbBossBoard | null>(null);
  const [clanOnly, setClanOnly] = useState(groupId != null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBoard(null);
    setFailed(false);
    pbBoard(npcId, clanOnly && scopeId ? scopeId : undefined)
      .then((b) => {
        if (!cancelled) setBoard(b);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [npcId, clanOnly, scopeId]);

  // The scoped group's name: the board echoes it once loaded; before that the
  // launch group is the only name to hand.
  const scopeName =
    (clanOnly ? board?.group_name : null) ?? (groupId == null ? group?.name : null) ?? "This clan";

  return (
    <div>
      <BackBar title={bossName} onBack={nav.pop} />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => nav.push({ name: "npc", id: npcId, label: bossName })}
          title="Drop table, loot and records"
          className="shrink-0"
        >
          <img src={npcIcon(npcId)} alt="" className="size-10 object-contain" />
        </button>
        {scopeId != null && (
          <div className="border-osrs-bronze/40 flex overflow-hidden rounded-lg border text-[11px]">
            <button
              type="button"
              onClick={() => setClanOnly(false)}
              className={`px-2.5 py-1.5 ${!clanOnly ? "bg-osrs-surface-3 text-osrs-gold-bright font-semibold" : "text-osrs-parchment-dark/60"}`}
            >
              Global
            </button>
            <button
              type="button"
              onClick={() => setClanOnly(true)}
              className={`max-w-40 truncate px-2.5 py-1.5 ${clanOnly ? "bg-osrs-surface-3 text-osrs-gold-bright font-semibold" : "text-osrs-parchment-dark/60"}`}
            >
              {scopeName}
            </button>
          </div>
        )}
        {board && (
          <span className="text-osrs-parchment-dark/55 text-[11.5px]">
            {board.player_count.toLocaleString()} ranked · {board.entry_count.toLocaleString()}{" "}
            times
          </span>
        )}
      </div>

      {failed ? (
        <ErrorNote>Couldn&apos;t load this board.</ErrorNote>
      ) : !board ? (
        <LoadingBlock rows={5} />
      ) : (
        <PbBoards board={board} />
      )}

      <button
        type="button"
        onClick={() => nav.push({ name: "npc", id: npcId, label: bossName })}
        className="text-osrs-gold-bright mt-4 text-[12.5px] font-semibold hover:underline"
      >
        Drop table &amp; loot for {bossName} →
      </button>
    </div>
  );
}
