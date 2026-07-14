"use client";

/**
 * Leaderboards tab: Players / Groups / Personal bests sub-tabs, period
 * switcher, and (when the launch guild has a group) a global-vs-clan scope
 * toggle. Rows push profile/board detail views.
 */
import { useEffect, useMemo, useState } from "react";
import type { LeaderboardPage, PbBossIndex } from "@droptracker/api-types";
import { Card, NameTile, RankMedal } from "@/components/ui";
import { PlayerBadgeIcons } from "@/components/player-badges";
import { gpText } from "@/lib/activity/money";
import { DEFAULT_PERIOD, PERIOD_OPTIONS, resolvePeriod, type PeriodKey } from "@/lib/period";
import { leaderboard, pbBosses } from "@/lib/activity/api";
import { useActivityData } from "@/lib/activity/data-context";
import { useActivityNav } from "@/lib/activity/nav";
import { ErrorNote, LoadingBlock, PressRow } from "@/components/activity/bits";
import { npcIcon } from "@/lib/activity/img";

type RankTab = "players" | "groups" | "pbs";

const SUB_TABS: { key: RankTab; label: string }[] = [
  { key: "players", label: "Players" },
  { key: "groups", label: "Groups" },
  { key: "pbs", label: "Personal bests" },
];

export function RanksView({ tab }: { tab: RankTab }) {
  const nav = useActivityNav();
  const { group } = useActivityData();

  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD);
  const [clanScope, setClanScope] = useState(false);
  const [page, setPage] = useState<LeaderboardPage | null>(null);
  const [pbIndex, setPbIndex] = useState<PbBossIndex | null>(null);
  const [bossFilter, setBossFilter] = useState("");
  const [failed, setFailed] = useState(false);

  const scope = clanScope && group ? `group:${group.id}` : undefined;

  useEffect(() => {
    if (tab === "pbs") return;
    let cancelled = false;
    setPage(null);
    setFailed(false);
    leaderboard(tab, resolvePeriod(period), tab === "players" ? scope : undefined)
      .then((p) => {
        if (!cancelled) setPage(p);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [tab, period, scope]);

  useEffect(() => {
    if (tab !== "pbs") return;
    let cancelled = false;
    setPbIndex(null);
    setFailed(false);
    pbBosses(clanScope && group ? group.id : undefined)
      .then((idx) => {
        if (!cancelled) setPbIndex(idx);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [tab, clanScope, group]);

  const bosses = useMemo(() => {
    const list = pbIndex?.bosses ?? [];
    const q = bossFilter.trim().toLowerCase();
    return q ? list.filter((b) => b.name.toLowerCase().includes(q)) : list;
  }, [pbIndex, bossFilter]);

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1.5" role="tablist" aria-label="Leaderboard type">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => nav.setRoot({ name: "ranks", tab: t.key })}
            className={`flex-1 rounded-xl border px-2 py-2 text-[12.5px] transition-colors ${
              tab === t.key
                ? "border-osrs-bronze/60 bg-osrs-surface-3 text-osrs-gold-bright font-semibold"
                : "border-osrs-bronze/30 bg-osrs-surface-1 text-osrs-parchment-dark/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Period + scope controls */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        {group ? (
          <div className="flex overflow-hidden rounded-lg border border-osrs-bronze/40 text-[11px]">
            <button
              onClick={() => setClanScope(false)}
              className={`px-2.5 py-1.5 ${!clanScope ? "bg-osrs-surface-3 text-osrs-gold-bright font-semibold" : "text-osrs-parchment-dark/60"}`}
            >
              Global
            </button>
            {tab !== "groups" && (
              <button
                onClick={() => setClanScope(true)}
                className={`max-w-36 truncate px-2.5 py-1.5 ${clanScope ? "bg-osrs-surface-3 text-osrs-gold-bright font-semibold" : "text-osrs-parchment-dark/60"}`}
              >
                {group.name}
              </button>
            )}
          </div>
        ) : (
          <span />
        )}
        {tab !== "pbs" && (
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodKey)}
            aria-label="Period"
            className="border-osrs-bronze/40 bg-osrs-surface-1 text-osrs-parchment rounded-lg border px-2 py-1.5 text-[11.5px] outline-none"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-2.5">
        {failed && <ErrorNote>Couldn&apos;t load the board — try again shortly.</ErrorNote>}

        {tab !== "pbs" && !failed && (
          <Card padding="p-0">
            {!page ? (
              <LoadingBlock rows={6} />
            ) : page.entries.length === 0 ? (
              <p className="text-osrs-parchment-dark/55 px-4 py-8 text-center text-sm">
                Nothing tracked for this period yet.
              </p>
            ) : (
              page.entries.map((e) => (
                <div key={e.id} className="border-osrs-bronze/20 border-b last:border-b-0">
                  <PressRow
                    name={e.name}
                    icon={
                      <span className="flex items-center gap-2.5">
                        <RankMedal rank={e.rank} />
                        <NameTile name={e.name} size="sm" flair={e.flair?.style} />
                      </span>
                    }
                    title={
                      <span className="flex items-center gap-1.5">
                        <span className="truncate">{e.name}</span>
                        {e.badges && e.badges.length > 0 && <PlayerBadgeIcons badges={e.badges} max={3} />}
                      </span>
                    }
                    right={
                      <span className="text-osrs-gold-bright text-[13px] font-semibold">
                        {gpText(e.loot)}
                      </span>
                    }
                    onPress={() =>
                      nav.push(tab === "players" ? { name: "player", id: e.id } : { name: "group", id: e.id })
                    }
                  />
                </div>
              ))
            )}
          </Card>
        )}

        {tab === "pbs" && !failed && (
          <div>
            <input
              value={bossFilter}
              onChange={(e) => setBossFilter(e.target.value)}
              placeholder="Filter bosses…"
              className="border-osrs-bronze/40 bg-osrs-surface-1 focus:border-osrs-gold text-osrs-parchment placeholder:text-osrs-parchment-dark/40 mb-2 w-full rounded-xl border px-3.5 py-2 text-sm outline-none"
            />
            <Card padding="p-0">
              {!pbIndex ? (
                <LoadingBlock rows={6} />
              ) : bosses.length === 0 ? (
                <p className="text-osrs-parchment-dark/55 px-4 py-8 text-center text-sm">
                  No bosses match.
                </p>
              ) : (
                bosses.slice(0, 40).map((b) => (
                  <div key={b.npc_id} className="border-osrs-bronze/20 border-b last:border-b-0">
                    <PressRow
                      name={b.name}
                      icon={
                        <img
                          src={npcIcon(b.npc_id)}
                          alt=""
                          className="size-8 shrink-0 object-contain"
                          loading="lazy"
                          onError={(ev) => {
                            (ev.currentTarget as HTMLImageElement).style.visibility = "hidden";
                          }}
                        />
                      }
                      title={
                        <span className="flex items-center gap-1.5">
                          <span className="truncate">{b.name}</span>
                          {b.featured && <span className="text-osrs-gold text-[10px]" aria-label="Featured">★</span>}
                        </span>
                      }
                      subtitle={`${b.player_count.toLocaleString()} players · ${b.entry_count.toLocaleString()} times`}
                      right={
                        b.best ? (
                          <span>
                            <span className="text-osrs-gold-bright block text-[12.5px] font-semibold">
                              {b.best.time_display}
                            </span>
                            <span className="text-osrs-parchment-dark/50 block text-[10px]">
                              {b.best.player_name}
                            </span>
                          </span>
                        ) : undefined
                      }
                      onPress={() => nav.push({ name: "pb-board", npcId: b.npc_id, bossName: b.name })}
                    />
                  </div>
                ))
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
