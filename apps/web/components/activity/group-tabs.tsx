"use client";

/**
 * The group profile's sub-pages for the Activity: Lootboard, Clan Log,
 * Personal bests and Points. Each mirrors its site page
 * (`/groups/[id]/{lootboard,log,personal-bests,points/leaderboard}`) and mounts
 * the same board components; only the period/boss pickers and paging are
 * Activity-side, because the site drives those through the URL.
 */
import { useEffect, useState } from "react";
import type { Lootboard, PbBossBoard, PbBossIndex, PointsLeaderboard } from "@droptracker/api-types";
import { ClanLogBoard } from "@/components/clan-log-board";
import { LootboardCanvas } from "@/components/lootboard-canvas";
import { PbBoards } from "@/components/pb-boards";
import { Card, NameTile, RankMedal, Select } from "@/components/ui";
import { formatClanLogPeriod } from "@/lib/clan-log";
import { PERIOD_OPTIONS, DEFAULT_PERIOD, resolvePeriod, type PeriodKey } from "@/lib/period";
import { isCombinedRow, otherAccounts, primaryShare } from "@/lib/points-leaderboard";
import {
  groupClanLog,
  groupLootboard,
  groupPoints,
  pbBoard,
  pbBosses,
  type GroupClanLog,
} from "@/lib/activity/api";
import { useActivityAuth } from "@/lib/activity/auth-context";
import { useActivityNav } from "@/lib/activity/nav";
import { EmptyNote, ErrorNote, LoadingBlock } from "@/components/activity/bits";

/** A joined row of period buttons (the site's tab links, as state). */
function Segments<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string; title?: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          title={o.title}
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={`rounded-lg px-2.5 py-1 text-[12px] transition-colors ${
            value === o.key
              ? "bg-osrs-bronze text-osrs-parchment font-semibold"
              : "text-osrs-parchment-dark/70 hover:text-osrs-gold-bright"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Load-on-change with the cancelled/failed bookkeeping every panel needs. */
function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<{ status?: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    load()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: { status?: number }) => {
        if (!cancelled) setError(err ?? {});
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error };
}

export function GroupLootboardTab({ groupId }: { groupId: number }) {
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD);
  const { data, error } = useLoad<Lootboard>(
    () => groupLootboard(groupId, resolvePeriod(period)),
    [groupId, period],
  );
  return (
    <div>
      <Segments options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      {error ? (
        <ErrorNote>Couldn&apos;t load the lootboard.</ErrorNote>
      ) : !data ? (
        <LoadingBlock rows={6} />
      ) : (
        <LootboardCanvas board={data} />
      )}
    </div>
  );
}

export function GroupClanLogTab({ groupId }: { groupId: number }) {
  const [period, setPeriod] = useState("all");
  const { data, error } = useLoad<GroupClanLog>(
    () => groupClanLog(groupId, period),
    [groupId, period],
  );
  // Keep the picker while a new period loads, so it doesn't jump.
  const [periods, setPeriods] = useState<string[]>([]);
  useEffect(() => {
    if (data?.periods.length) setPeriods(data.periods);
  }, [data]);

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-3 text-[12.5px]">
        Every boss unique we track, and who in the clan pulled it.
      </p>
      {periods.length > 1 && (
        <Segments
          options={periods.slice(0, 18).map((p) => ({ key: p, label: formatClanLogPeriod(p) }))}
          value={period}
          onChange={setPeriod}
        />
      )}
      {error ? (
        <ErrorNote>Couldn&apos;t load the Clan Log.</ErrorNote>
      ) : !data ? (
        <LoadingBlock rows={6} />
      ) : !data.board ? (
        <EmptyNote>This clan&apos;s log hasn&apos;t been built yet.</EmptyNote>
      ) : (
        <>
          <ClanLogBoard board={data.board} />
          <p className="text-osrs-parchment-dark/50 mt-3 text-center text-[11px]">
            A slot counts as obtained when a tracked drop, collection-log unlock or pet submission
            named it. Anything obtained before the clan started tracking is shown as not seen.
          </p>
        </>
      )}
    </div>
  );
}

export function GroupPbsTab({ groupId }: { groupId: number }) {
  const { data: index, error } = useLoad<PbBossIndex>(() => pbBosses(groupId), [groupId]);
  const [selected, setSelected] = useState<number | null>(null);
  const npcId = selected ?? index?.bosses[0]?.npc_id ?? null;
  const { data: board, error: boardError } = useLoad<PbBossBoard | null>(
    () => (npcId != null ? pbBoard(npcId, groupId) : Promise.resolve(null)),
    [groupId, npcId],
  );

  if (error) return <ErrorNote>Couldn&apos;t load this clan&apos;s personal bests.</ErrorNote>;
  if (!index) return <LoadingBlock rows={5} />;
  if (index.bosses.length === 0) {
    return (
      <EmptyNote>
        No personal bests yet. Kill times appear here once members submit them with the RuneLite
        plugin.
      </EmptyNote>
    );
  }
  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-3 text-[12.5px]">
        Kill-time leaderboards among this clan&apos;s members, with each time&apos;s global standing.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select
          value={npcId ?? undefined}
          onChange={(e) => setSelected(Number(e.target.value))}
          aria-label="Choose a boss"
          className="w-full max-w-sm"
        >
          {index.bosses.map((b) => (
            <option key={b.npc_id} value={b.npc_id}>
              {b.name} ({b.player_count.toLocaleString()} ranked)
            </option>
          ))}
        </Select>
        {board && (
          <span className="text-osrs-parchment-dark/60 text-[12px]">
            {board.player_count.toLocaleString()} members ranked
          </span>
        )}
      </div>
      {boardError ? (
        <ErrorNote>Couldn&apos;t load this board.</ErrorNote>
      ) : !board ? (
        <LoadingBlock rows={4} />
      ) : (
        <PbBoards board={board} />
      )}
    </div>
  );
}

const POINTS_PERIODS: { key: string; label: string }[] = [
  { key: "month", label: "Monthly" },
  { key: "week", label: "Weekly" },
  { key: "day", label: "Daily" },
  { key: "all", label: "All-time" },
];

export function GroupPointsTab({ groupId, groupName }: { groupId: number; groupName: string }) {
  const nav = useActivityNav();
  const { sessionToken } = useActivityAuth();
  const [period, setPeriod] = useState("month");
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const { data, error } = useLoad<PointsLeaderboard>(
    () => groupPoints(groupId, { period, page, q: query }, sessionToken),
    [groupId, period, page, query, sessionToken],
  );
  // Seasons only arrive with a board; keep them while the next one loads.
  const [seasons, setSeasons] = useState<PointsLeaderboard["seasons"]>([]);
  useEffect(() => {
    if (data) setSeasons(data.seasons);
  }, [data]);

  if (error?.status === 403) {
    return (
      <EmptyNote>
        {groupName} keeps its points leaderboard visible to members only.
        {sessionToken ? "" : " Sign in with a member account to see it."}
      </EmptyNote>
    );
  }

  const options = [
    ...POINTS_PERIODS,
    ...seasons.map((s) => ({
      key: `season:${s.id}`,
      label: s.active ? `${s.name} ●` : s.name,
      title:
        s.start_at && s.end_at
          ? `${new Date(s.start_at).toLocaleDateString()} to ${new Date(s.end_at).toLocaleDateString()}`
          : undefined,
    })),
  ];
  const totalPages = data ? Math.max(1, Math.ceil(data.meta.total / data.meta.limit)) : 1;
  const choosePeriod = (key: string) => {
    setPeriod(key);
    setPage(1);
  };

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-3 text-[12.5px]">
        Points awarded by {groupName}&apos;s custom point rules.
      </p>
      <Segments options={options} value={period} onChange={choosePeriod} />
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(draft.trim());
          setPage(1);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Find a member…"
          maxLength={40}
          className="border-osrs-bronze/40 bg-osrs-surface-2 focus:ring-osrs-gold/40 min-w-0 flex-1 rounded-lg border px-3 py-1.5 text-[13px] focus:ring-2 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setQuery("");
              setPage(1);
            }}
            className="text-osrs-gold-bright text-[12px] hover:underline"
          >
            Clear
          </button>
        )}
      </form>

      {error ? (
        <ErrorNote>Couldn&apos;t load the points leaderboard.</ErrorNote>
      ) : !data ? (
        <LoadingBlock rows={6} />
      ) : data.entries.length === 0 ? (
        <EmptyNote>
          {query
            ? `No one matching “${query}” has points in this period.`
            : "No points earned in this period yet."}
        </EmptyNote>
      ) : (
        <>
          <p className="text-osrs-parchment-dark/55 mb-1.5 text-[11.5px]">
            {data.meta.total.toLocaleString()} ranked
            {data.combined && " · each member's accounts are counted together"}
          </p>
          <Card padding="p-1.5">
            {data.entries.map((row) => (
              <div key={row.id}>
                <button
                  type="button"
                  onClick={() => nav.push({ name: "player", id: row.id })}
                  className="hover:bg-osrs-surface-2/60 flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left"
                >
                  <RankMedal rank={row.rank} />
                  <NameTile name={row.name} size="sm" playerId={row.id} />
                  <span className="text-osrs-parchment min-w-0 flex-1 truncate text-[13px]">
                    {row.name}
                  </span>
                  <span className="text-osrs-gold-bright shrink-0 text-[13px] font-semibold tabular-nums">
                    {row.points.toLocaleString()}
                  </span>
                </button>
                {isCombinedRow(row) && (
                  <p className="text-osrs-parchment-dark/55 flex flex-wrap gap-x-3 pb-1 pl-12 text-[11px]">
                    <span>
                      {row.name}: {primaryShare(row).toLocaleString()}
                    </span>
                    {otherAccounts(row).map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => nav.push({ name: "player", id: a.id })}
                        className="hover:text-osrs-gold-bright"
                      >
                        {a.name}: {a.points.toLocaleString()}
                      </button>
                    ))}
                  </p>
                )}
              </div>
            ))}
          </Card>
          {totalPages > 1 && (
            <div className="mt-2 flex items-center justify-center gap-3 text-[12.5px]">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="text-osrs-gold-bright disabled:text-osrs-parchment-dark/30 hover:underline"
              >
                ← Previous
              </button>
              <span className="text-osrs-parchment-dark/60">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="text-osrs-gold-bright disabled:text-osrs-parchment-dark/30 hover:underline"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
