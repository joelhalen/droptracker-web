"use client";

/**
 * Per-boss personal-best boards (one card per team size), pushed from the
 * PB index. Entries push the player's profile.
 */
import { useEffect, useState } from "react";
import type { PbBossBoard } from "@droptracker/api-types";
import { Card, RankMedal } from "@/components/ui";
import { LocalTime } from "@/components/local-time";
import { pbBoard } from "@/lib/activity/api";
import { useActivityData } from "@/lib/activity/data-context";
import { useActivityNav } from "@/lib/activity/nav";
import { BackBar, ErrorNote, ExternalButton, LoadingBlock } from "@/components/activity/bits";
import { npcIcon } from "@/lib/activity/img";

export function PbBoardView({ npcId, bossName }: { npcId: number; bossName: string }) {
  const nav = useActivityNav();
  const { group } = useActivityData();
  const [board, setBoard] = useState<PbBossBoard | null>(null);
  const [clanOnly, setClanOnly] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBoard(null);
    setFailed(false);
    pbBoard(npcId, clanOnly && group ? group.id : undefined)
      .then((b) => {
        if (!cancelled) setBoard(b);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [npcId, clanOnly, group]);

  return (
    <div>
      <BackBar title={bossName} onBack={nav.pop} />

      <div className="mb-2.5 flex items-center gap-3">
        <img src={npcIcon(npcId)} alt="" className="size-10 object-contain" />
        {group && (
          <div className="flex overflow-hidden rounded-lg border border-osrs-bronze/40 text-[11px]">
            <button
              onClick={() => setClanOnly(false)}
              className={`px-2.5 py-1.5 ${!clanOnly ? "bg-osrs-surface-3 text-osrs-gold-bright font-semibold" : "text-osrs-parchment-dark/60"}`}
            >
              Global
            </button>
            <button
              onClick={() => setClanOnly(true)}
              className={`max-w-36 truncate px-2.5 py-1.5 ${clanOnly ? "bg-osrs-surface-3 text-osrs-gold-bright font-semibold" : "text-osrs-parchment-dark/60"}`}
            >
              {group.name}
            </button>
          </div>
        )}
      </div>

      {failed && <ErrorNote>Couldn&apos;t load this board.</ErrorNote>}
      {!failed && !board && <LoadingBlock rows={5} />}

      {board && board.boards.length === 0 && (
        <ErrorNote>No tracked personal bests here yet.</ErrorNote>
      )}

      <div className="space-y-3">
        {board?.boards.map((tb) => (
          <Card key={tb.team_size} padding="p-3.5">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-osrs-gold font-serif text-[13.5px] font-semibold">
                {tb.size_label}
              </span>
              <span className="text-osrs-parchment-dark/50 text-[10.5px] uppercase">
                {tb.total_players.toLocaleString()} players
              </span>
            </div>
            <div className="space-y-1">
              {tb.entries.slice(0, 5).map((e) => (
                <button
                  key={`${e.rank}-${e.player_id}`}
                  onClick={() => nav.push({ name: "player", id: e.player_id })}
                  className="hover:bg-osrs-surface-2/60 flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left"
                >
                  <RankMedal rank={e.rank} />
                  <span className="text-osrs-parchment min-w-0 flex-1 truncate text-[13px]">
                    {e.player_name}
                  </span>
                  <span className="text-osrs-parchment-dark/45 shrink-0 text-[10.5px]">
                    <LocalTime unix={e.date_ts} mode="date" />
                  </span>
                  <span className="text-osrs-gold-bright shrink-0 text-[13px] font-semibold tabular-nums">
                    {e.time_display}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <ExternalButton href={`https://www.droptracker.io/npcs/${npcId}`}>
        Full boards & drop table on droptracker.io
      </ExternalButton>
    </div>
  );
}
