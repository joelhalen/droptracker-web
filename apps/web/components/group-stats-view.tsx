"use client";

/**
 * The clan stats page body (suggestion #224): one payload, six views.
 *
 *   Overview   clan totals, standouts (top 3 per category), skill and boss
 *              leaders, and when the clan plays
 *   Members    every member, every stat, sortable, filterable, exportable
 *   Skills     XP per skill, then who earned it
 *   Bosses     kill counts per boss (Wise Old Man) and loot per source
 *   Loot       the biggest drops (with proof) and the top items
 *   Activity   every pet, log slot, PB, CA, quest, diary, task, kill, death
 *
 * Clicking any member opens their drilldown: their numbers, rank in the clan,
 * skills, bosses, sources, items and activity for the same period.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import type { GroupStats, GroupStatsMember, StandoutCategory, StandoutLeader } from "@droptracker/api-types";
import { Badge, Button, Card, EmptyState, Input, RankMedal, ToggleChip, cn } from "@/components/ui";
import { formatGp } from "@/lib/format";
import { metricIconUrl, metricLabel } from "@/lib/osrs-metrics";
import {
  COLUMN_GROUPS,
  FEED_KINDS,
  availableColumns,
  feedTimeline,
  filterMembers,
  formatStat,
  memberDetail,
  memberName,
  membersCsv,
  periodLabel,
  shortDate,
  sortMembers,
  type ColumnGroup,
  type FeedKind,
  type StatUnit,
} from "@/lib/group-stats";

type Tab = "overview" | "members" | "skills" | "bosses" | "loot" | "activity";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "members", label: "Members" },
  { key: "skills", label: "Skills" },
  { key: "bosses", label: "Bosses" },
  { key: "loot", label: "Loot" },
  { key: "activity", label: "Activity" },
];

const TOTALS: { key: keyof GroupStats["totals"]; label: string; unit: StatUnit }[] = [
  { key: "loot", label: "Loot", unit: "gp" },
  { key: "xp", label: "XP gained", unit: "xp" },
  { key: "levels", label: "Levels gained", unit: "count" },
  { key: "kills", label: "Boss kills", unit: "count" },
  { key: "ehb", label: "EHB", unit: "hours" },
  { key: "ehp", label: "EHP", unit: "hours" },
  { key: "drops", label: "Drops", unit: "count" },
  { key: "unique_items", label: "Unique items", unit: "count" },
  { key: "clog_slots", label: "Log slots", unit: "count" },
  { key: "pets", label: "Pets", unit: "count" },
  { key: "pbs", label: "Personal bests", unit: "count" },
  { key: "cas", label: "Combat achievements", unit: "count" },
  { key: "clues", label: "Clues", unit: "count" },
  { key: "slayer_tasks", label: "Slayer tasks", unit: "count" },
  { key: "quests", label: "Quests", unit: "count" },
  { key: "diaries", label: "Diaries", unit: "count" },
  { key: "pvp_kills", label: "PvP kills", unit: "count" },
  { key: "deaths", label: "Deaths", unit: "count" },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function unitFor(unit: string): StatUnit {
  return unit === "gp" || unit === "xp" || unit === "hours" ? unit : "count";
}

function Sprite({ id, className }: { id: number | null | undefined; className?: string }) {
  if (id == null) return null;
  return <img src={`/img/itemdb/${id}.png`} alt="" loading="lazy" className={cn("h-6 w-auto object-contain", className)} />;
}

function MetricIcon({ metric }: { metric: string }) {
  const src = metricIconUrl(metric);
  return src ? <img src={src} alt="" loading="lazy" className="h-5 w-5 object-contain" /> : <span className="h-5 w-5" />;
}

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="bg-osrs-bronze/20 h-1.5 w-full overflow-hidden rounded">
      <div className="bg-osrs-gold/70 h-full rounded" style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%` }} />
    </div>
  );
}

export function GroupStatsView({ stats }: { stats: GroupStats }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [member, setMember] = useState<number | null>(null);
  const name = (pid: number) => memberName(stats, pid);
  const Who = ({ pid, className }: { pid: number; className?: string }) => (
    <button
      type="button"
      onClick={() => setMember(pid)}
      className={cn("text-osrs-parchment hover:text-osrs-gold-bright cursor-pointer truncate text-left", className)}
    >
      {name(pid)}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {TABS.map((t) => (
          <ToggleChip key={t.key} shape="tab" role="tab" aria-selected={tab === t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </ToggleChip>
        ))}
      </div>

      {tab === "overview" && <Overview stats={stats} Who={Who} />}
      {tab === "members" && <Members stats={stats} onPick={setMember} />}
      {tab === "skills" && <Leaders stats={stats} kind="skills" Who={Who} />}
      {tab === "bosses" && <Leaders stats={stats} kind="bosses" Who={Who} />}
      {tab === "loot" && <Loot stats={stats} Who={Who} />}
      {tab === "activity" && <Activity stats={stats} Who={Who} />}

      {member !== null && <MemberDrawer stats={stats} playerId={member} onClose={() => setMember(null)} />}
    </div>
  );
}

type WhoComp = (props: { pid: number; className?: string }) => ReactNode;

/* ── Overview ────────────────────────────────────────────────────────── */
function Overview({ stats, Who }: { stats: GroupStats; Who: WhoComp }) {
  const t = stats.totals;
  const tiles = TOTALS.filter(({ key }) => (t[key] ?? 0) > 0);
  const cats = stats.standouts.categories;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Card padding="p-3">
          <div className="text-osrs-parchment-dark/60 text-xs uppercase">Members active</div>
          <div className="text-osrs-gold text-xl font-bold tabular-nums">{(t.members_active ?? 0).toLocaleString()}</div>
          <div className="text-osrs-parchment-dark/50 text-xs">of {(t.members_total ?? 0).toLocaleString()}</div>
        </Card>
        {tiles.map(({ key, label, unit }) => (
          <Card key={key} padding="p-3">
            <div className="text-osrs-parchment-dark/60 text-xs uppercase">{label}</div>
            <div className="text-osrs-gold text-xl font-bold tabular-nums">{formatStat(t[key], unit)}</div>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-osrs-gold mb-2 text-lg font-semibold">Standouts</h2>
        {cats.length === 0 ? (
          <EmptyState title="No standouts yet" hint="Nobody has scored in any category this period." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cats.map((c) => (
              <StandoutCard key={c.key} category={c} Who={Who} />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LeaderList title="Skill leaders" rows={stats.standouts.skills.slice(0, 10)} unit="xp" Who={Who} empty="No XP data for this period." />
        <LeaderList title="Boss leaders" rows={stats.standouts.bosses.slice(0, 10)} unit="count" suffix=" kc" Who={Who} empty="No kill counts for this period." />
      </div>

      {stats.activity && <ActivityChart activity={stats.activity} />}
    </div>
  );
}

function StandoutCard({ category, Who }: { category: StandoutCategory; Who: WhoComp }) {
  const unit = unitFor(category.unit);
  return (
    <Card padding="p-3" className="space-y-2">
      <div className="text-osrs-parchment-dark/70 text-xs font-semibold tracking-wide uppercase">{category.label}</div>
      <ol className="space-y-1.5">
        {category.entries.map((e, i) => (
          <li key={`${e.player_id}-${i}`} className="flex items-center gap-2">
            <RankMedal rank={i + 1} />
            <div className="min-w-0 flex-1">
              <Who pid={e.player_id} className={i === 0 ? "font-semibold" : "text-sm"} />
              {e.detail && (
                <div className="text-osrs-parchment-dark/55 flex items-center gap-1 truncate text-xs">
                  <Sprite id={e.item_id} className="h-4" />
                  {e.detail}
                </div>
              )}
            </div>
            <span className={cn("text-osrs-gold shrink-0 tabular-nums", i === 0 ? "font-bold" : "text-sm")}>
              {formatStat(e.value, unit)}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function LeaderList({
  title, rows, unit, suffix = "", Who, empty,
}: {
  title: string; rows: StandoutLeader[]; unit: StatUnit; suffix?: string; Who: WhoComp; empty: string;
}) {
  // The figure beside the leader is THEIR number; the clan's total sits under
  // it. Showing the clan total alone made it read as one player's 60k kc
  // (suggestion #224).
  const lead = (r: StandoutLeader) => r.entries[0]?.value ?? 0;
  const max = Math.max(...rows.map(lead), 1);
  return (
    <Card padding="p-4">
      <h3 className="text-osrs-gold mb-2 font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-osrs-parchment-dark/60 text-sm">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.metric} className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <MetricIcon metric={r.metric} />
                <span className="text-osrs-parchment w-36 shrink-0 truncate">{metricLabel(r.metric)}</span>
                <span className="min-w-0 flex-1 truncate">{r.entries[0] && <Who pid={r.entries[0].player_id} className="text-sm" />}</span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="text-osrs-gold">
                    {formatStat(lead(r), unit)}
                    {suffix}
                  </span>
                  <span className="text-osrs-parchment-dark/50 block text-[11px] leading-tight">
                    clan {formatStat(r.total, unit)}
                    {suffix}
                  </span>
                </span>
              </div>
              <Bar value={lead(r)} max={max} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ActivityChart({ activity }: { activity: NonNullable<GroupStats["activity"]> }) {
  const hourMax = Math.max(...activity.by_hour, 1);
  const dayMax = Math.max(...activity.by_weekday, 1);
  return (
    <Card padding="p-4">
      <h3 className="text-osrs-gold mb-1 font-semibold">When the clan plays</h3>
      <p className="text-osrs-parchment-dark/60 mb-3 text-xs">Hours with loot, by time of day (UTC) and day of the week.</p>
      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div className="flex h-28 items-end gap-0.5">
          {activity.by_hour.map((v, h) => (
            <div key={h} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${String(h).padStart(2, "0")}:00 · ${v.toLocaleString()}`}>
              <div className="flex w-full flex-1 items-end"><div className="bg-osrs-gold/60 w-full rounded-t" style={{ height: `${Math.max(3, (v / hourMax) * 100)}%` }} /></div>
              <span className="text-osrs-parchment-dark/50 h-3 text-[10px]">{h % 3 === 0 ? h : ""}</span>
            </div>
          ))}
        </div>
        <div className="flex h-28 items-end gap-1">
          {activity.by_weekday.map((v, d) => (
            <div key={d} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${WEEKDAYS[d]} · ${v.toLocaleString()}`}>
              <div className="flex w-full flex-1 items-end"><div className="bg-osrs-gold/60 w-full rounded-t" style={{ height: `${Math.max(3, (v / dayMax) * 100)}%` }} /></div>
              <span className="text-osrs-parchment-dark/50 text-[10px]">{WEEKDAYS[d]}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ── Members ─────────────────────────────────────────────────────────── */
function Members({ stats, onPick }: { stats: GroupStats; onPick: (pid: number) => void }) {
  const columns = useMemo(() => availableColumns(stats), [stats]);
  const [groups, setGroups] = useState<Set<ColumnGroup>>(new Set(COLUMN_GROUPS.map((g) => g.key)));
  const [sortKey, setSortKey] = useState<keyof GroupStatsMember>("loot");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const shown = columns.filter((c) => groups.has(c.group));
  const rows = useMemo(
    () => sortMembers(filterMembers(stats.members, stats.names, query, activeOnly), sortKey, dir, stats.names),
    [stats, query, activeOnly, sortKey, dir],
  );
  const maxOf = useMemo(
    () => Object.fromEntries(shown.map((c) => [c.key, Math.max(...stats.members.map((m) => Number(m[c.key] ?? 0)), 0)])),
    [shown, stats.members],
  );

  function sortBy(key: keyof GroupStatsMember) {
    if (key === sortKey) setDir(dir === "desc" ? "asc" : "desc");
    else {
      setSortKey(key);
      setDir(key === "player_id" ? "asc" : "desc");
    }
  }

  function download() {
    const blob = new Blob([membersCsv(stats, columns, rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(stats.group.name ?? "clan").replace(/[^\w-]+/g, "_")}-${stats.period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="border-osrs-bronze/25 flex flex-wrap items-center gap-2 border-b p-3">
        <Input fieldSize="sm" className="w-48" placeholder="Search members" value={query} onChange={(e) => setQuery(e.target.value)} />
        <ToggleChip active={activeOnly} onClick={() => setActiveOnly(!activeOnly)}>
          Active only
        </ToggleChip>
        <span className="text-osrs-parchment-dark/40 mx-1">|</span>
        {COLUMN_GROUPS.filter((g) => columns.some((c) => c.group === g.key)).map((g) => (
          <ToggleChip
            key={g.key}
            active={groups.has(g.key)}
            onClick={() => {
              const next = new Set(groups);
              if (next.has(g.key)) next.delete(g.key);
              else next.add(g.key);
              setGroups(next);
            }}
          >
            {g.label}
          </ToggleChip>
        ))}
        <span className="flex-1" />
        <span className="text-osrs-parchment-dark/60 text-xs">{rows.length.toLocaleString()} members</span>
        <Button size="xs" variant="ghost" onClick={download}>
          Download CSV
        </Button>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-osrs-surface-2 sticky top-0 z-10">
            <tr className="text-osrs-parchment-dark/70 text-xs">
              <th className="px-2 py-2 text-right">#</th>
              <th className="bg-osrs-surface-2 sticky left-0 px-2 py-2 text-left">
                <button type="button" className="cursor-pointer hover:text-osrs-gold" onClick={() => sortBy("player_id")}>
                  Member {sortKey === "player_id" ? (dir === "asc" ? "▲" : "▼") : ""}
                </button>
              </th>
              {shown.map((c) => (
                <th key={c.key} className="px-2 py-2 text-right whitespace-nowrap" title={c.label}>
                  <button type="button" className={cn("cursor-pointer hover:text-osrs-gold", sortKey === c.key && "text-osrs-gold")} onClick={() => sortBy(c.key)}>
                    {c.short} {sortKey === c.key ? (dir === "asc" ? "▲" : "▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={m.player_id} className="border-osrs-bronze/15 hover:bg-osrs-gold/5 border-t">
                <td className="text-osrs-parchment-dark/50 px-2 py-1.5 text-right tabular-nums">{i + 1}</td>
                <td className="bg-osrs-surface-1 sticky left-0 max-w-[12rem] px-2 py-1.5">
                  <button type="button" onClick={() => onPick(m.player_id)} className="text-osrs-parchment hover:text-osrs-gold-bright cursor-pointer truncate">
                    {memberName(stats, m.player_id)}
                  </button>
                </td>
                {shown.map((c) => {
                  const v = Number(m[c.key] ?? 0);
                  const top = v > 0 && v === maxOf[c.key];
                  return (
                    <td key={c.key} className={cn("px-2 py-1.5 text-right tabular-nums", top ? "text-osrs-gold font-semibold" : v ? "text-osrs-parchment" : "text-osrs-parchment-dark/30")}>
                      {formatStat(m[c.key] as number, c.unit)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState title="No members match" />}
      </div>
    </Card>
  );
}

/* ── Skills / Bosses ─────────────────────────────────────────────────── */
function Leaders({ stats, kind, Who }: { stats: GroupStats; kind: "skills" | "bosses"; Who: WhoComp }) {
  const [view, setView] = useState<"kc" | "sources">("kc");
  const list = kind === "skills" ? stats.skills : stats.bosses;
  const [selected, setSelected] = useState<string | null>(list[0]?.metric ?? null);
  const [source, setSource] = useState<number | null>(stats.sources[0]?.npc_id ?? null);
  const allTime = stats.kind === "all";
  const noWom = list.length === 0;

  if (kind === "bosses" && view === "sources") {
    const src = stats.sources.find((s) => s.npc_id === source) ?? null;
    return (
      <div className="space-y-3">
        <BossToggle view={view} setView={setView} hasSources={stats.sources.length > 0} />
        <TwoPane
          left={stats.sources.map((s) => ({
            id: String(s.npc_id),
            label: s.name,
            value: `${formatGp(s.loot)}`,
            sub: `${s.drops.toLocaleString()} drops · ${s.member_count} members`,
            icon: null,
          }))}
          selected={source === null ? null : String(source)}
          onSelect={(id) => setSource(Number(id))}
          empty={stats.coverage.sources ? "No loot this period." : "Loot by source isn't available for this period."}
          right={
            src && (
              <RankTable
                title={src.name}
                head={["Loot", "Drops"]}
                rows={src.members.map(([pid, loot, drops]) => ({ pid, cells: [formatGp(loot), drops.toLocaleString()] }))}
                Who={Who}
                note={src.member_count > src.members.length ? `Top ${src.members.length} of ${src.member_count}` : undefined}
              />
            )
          }
        />
      </div>
    );
  }

  const entry = list.find((s) => s.metric === selected) ?? null;
  return (
    <div className="space-y-3">
      {kind === "bosses" && <BossToggle view={view} setView={setView} hasSources={stats.sources.length > 0} />}
      {noWom ? (
        <EmptyState
          title={kind === "skills" ? "No XP data for this period" : "No kill counts for this period"}
          hint={
            stats.coverage.wom === "unlinked"
              ? "XP and kill counts come from Wise Old Man. Link your clan's Wise Old Man group in Settings to see them."
              : "Wise Old Man has no gains for this clan in this period yet."
          }
        />
      ) : (
        <TwoPane
          left={list.map((s) => {
            const levels = "levels" in s ? s.levels : null;
            return {
              id: s.metric,
              label: metricLabel(s.metric),
              value: kind === "skills" ? `${formatGp(s.total)} xp` : `${s.total.toLocaleString()} kc`,
              sub: [levels ? `${levels.toLocaleString()} levels` : null, `${s.member_count} members`].filter(Boolean).join(" · "),
              icon: s.metric,
            };
          })}
          selected={selected}
          onSelect={setSelected}
          empty=""
          right={
            entry && (
              <RankTable
                title={metricLabel(entry.metric)}
                head={kind === "skills" ? [allTime ? "XP" : "XP gained", allTime ? "Level" : "Levels"] : [allTime ? "Kill count" : "Kills"]}
                rows={entry.members.map((r) => ({
                  pid: r[0],
                  cells: kind === "skills" ? [formatGp(r[1]), (r as number[])[2] ? String((r as number[])[2]) : "–"] : [r[1].toLocaleString()],
                }))}
                Who={Who}
              />
            )
          }
        />
      )}
    </div>
  );
}

function BossToggle({ view, setView, hasSources }: { view: "kc" | "sources"; setView: (v: "kc" | "sources") => void; hasSources: boolean }) {
  return (
    <div className="flex gap-1.5">
      <ToggleChip active={view === "kc"} onClick={() => setView("kc")}>
        Kill counts
      </ToggleChip>
      <ToggleChip active={view === "sources"} disabled={!hasSources} onClick={() => setView("sources")}>
        Loot by source
      </ToggleChip>
    </div>
  );
}

function TwoPane({
  left, selected, onSelect, right, empty,
}: {
  left: { id: string; label: string; value: string; sub: string; icon: string | null }[];
  selected: string | null;
  onSelect: (id: string) => void;
  right: ReactNode;
  empty: string;
}) {
  if (left.length === 0) return <EmptyState title={empty || "Nothing here yet"} />;
  return (
    <div className="grid items-start gap-3 lg:grid-cols-[minmax(260px,360px)_1fr]">
      <Card padding="p-1.5" className="max-h-[70vh] overflow-auto">
        <ul>
          {left.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onSelect(row.id)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
                  selected === row.id ? "bg-osrs-gold/15" : "hover:bg-osrs-gold/5",
                )}
              >
                {row.icon && <MetricIcon metric={row.icon} />}
                <span className="min-w-0 flex-1">
                  <span className="text-osrs-parchment block truncate">{row.label}</span>
                  <span className="text-osrs-parchment-dark/50 block truncate text-xs">{row.sub}</span>
                </span>
                <span className="text-osrs-gold shrink-0 tabular-nums">{row.value}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <div>{right}</div>
    </div>
  );
}

function RankTable({
  title, head, rows, Who, note,
}: {
  title: string; head: string[]; rows: { pid: number; cells: string[] }[]; Who: WhoComp; note?: string;
}) {
  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="border-osrs-bronze/25 flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-osrs-gold font-semibold">{title}</h3>
        {note && <span className="text-osrs-parchment-dark/50 text-xs">{note}</span>}
      </div>
      <div className="max-h-[64vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-osrs-parchment-dark/60 text-xs">
            <tr>
              <th className="px-3 py-1.5 text-right">#</th>
              <th className="px-3 py-1.5 text-left">Member</th>
              {head.map((h) => (
                <th key={h} className="px-3 py-1.5 text-right">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.pid} className="border-osrs-bronze/15 border-t">
                <td className="px-3 py-1.5 text-right">{i < 3 ? <RankMedal rank={i + 1} /> : <span className="text-osrs-parchment-dark/50">{i + 1}</span>}</td>
                <td className="max-w-[14rem] px-3 py-1.5">
                  <Who pid={r.pid} />
                </td>
                {r.cells.map((c, j) => (
                  <td key={j} className={cn("px-3 py-1.5 text-right tabular-nums", j === 0 ? "text-osrs-gold" : "text-osrs-parchment")}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ── Loot ────────────────────────────────────────────────────────────── */
function Loot({ stats, Who }: { stats: GroupStats; Who: WhoComp }) {
  if (!stats.coverage.items) {
    return <EmptyState title="Item breakdowns are for months and years" hint="Pick a month or a year to see the biggest drops and top items." />;
  }
  return (
    <div className="space-y-4">
      <Card padding="p-4">
        <h3 className="text-osrs-gold mb-3 font-semibold">Biggest drops</h3>
        {stats.big_drops.length === 0 ? (
          <p className="text-osrs-parchment-dark/60 text-sm">No drops this period.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {stats.big_drops.map((d) => (
              <li key={d.drop_id} className="border-osrs-bronze/25 flex items-center gap-3 rounded-lg border p-2">
                <Sprite id={d.item_id} className="h-8" />
                <div className="min-w-0 flex-1">
                  <div className="text-osrs-parchment truncate font-medium">
                    {d.name ?? "Unknown item"}
                    {d.quantity > 1 ? ` ×${d.quantity.toLocaleString()}` : ""}
                  </div>
                  <div className="text-osrs-parchment-dark/60 flex flex-wrap items-center gap-x-1.5 text-xs">
                    <Who pid={d.player_id} className="text-xs" />
                    {d.source && <span>· {d.source}</span>}
                    {d.date && <span>· {shortDate(d.date)}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-osrs-gold font-semibold tabular-nums">{formatGp(d.value)}</div>
                  {d.image_url && (
                    <a href={d.image_url} target="_blank" rel="noreferrer" className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-xs">
                      screenshot ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card padding="p-4">
        <h3 className="text-osrs-gold mb-3 font-semibold">Top items</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {stats.items.map((item) => (
            <div key={item.item_id} className="border-osrs-bronze/25 flex flex-col items-center gap-1 rounded-lg border p-2 text-center">
              <Sprite id={item.item_id} className="h-9" />
              <div className="text-osrs-parchment w-full truncate text-xs">{item.name}</div>
              <div className="text-osrs-gold text-sm font-semibold tabular-nums">{formatGp(item.loot)}</div>
              <div className="text-osrs-parchment-dark/55 w-full truncate text-xs">
                {item.receivers[0] && <Who pid={item.receivers[0][0]} className="text-xs" />}
                {item.receiver_count > 1 ? ` +${item.receiver_count - 1}` : ""}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ── Activity ────────────────────────────────────────────────────────── */
function Activity({ stats, Who }: { stats: GroupStats; Who: WhoComp }) {
  const present = FEED_KINDS.filter((k) => stats.feeds[k.key].length > 0);
  const [kinds, setKinds] = useState<Set<FeedKind>>(new Set(present.map((k) => k.key)));
  const entries = useMemo(() => feedTimeline(stats, kinds), [stats, kinds]);
  if (present.length === 0) return <EmptyState title="Nothing logged this period" />;
  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="border-osrs-bronze/25 flex flex-wrap gap-1.5 border-b p-3">
        {present.map((k) => (
          <ToggleChip
            key={k.key}
            active={kinds.has(k.key)}
            onClick={() => {
              const next = new Set(kinds);
              if (next.has(k.key)) next.delete(k.key);
              else next.add(k.key);
              setKinds(next);
            }}
          >
            {k.label} <span className="text-osrs-parchment-dark/50">{stats.feeds[k.key].length}</span>
          </ToggleChip>
        ))}
      </div>
      <ul className="max-h-[70vh] divide-y divide-osrs-bronze/15 overflow-auto">
        {entries.map((e, i) => (
          <li key={`${e.kind}-${e.player_id}-${e.date}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="text-osrs-parchment-dark/50 w-14 shrink-0 text-xs tabular-nums">{shortDate(e.date)}</span>
            {e.item_id ? <Sprite id={e.item_id} className="h-5" /> : <span className="w-5" />}
            <span className="min-w-0 flex-1 truncate">
              <Who pid={e.player_id} className="font-medium" /> <span className="text-osrs-parchment-dark/80">{e.text}</span>
            </span>
            {e.detail && <span className="text-osrs-parchment-dark/55 hidden shrink-0 text-xs sm:inline">{e.detail}</span>}
          </li>
        ))}
      </ul>
      <p className="text-osrs-parchment-dark/45 border-osrs-bronze/25 border-t px-3 py-2 text-xs">
        The newest {stats.feeds.pets.length >= 150 ? "150 " : ""}entries of each kind for {periodLabel(stats.period)}.
      </p>
    </Card>
  );
}

/* ── Member drilldown ────────────────────────────────────────────────── */
function MemberDrawer({ stats, playerId, onClose }: { stats: GroupStats; playerId: number; onClose: () => void }) {
  const d = useMemo(() => memberDetail(stats, playerId), [stats, playerId]);
  const columns = availableColumns(stats);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const row = d.row;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal>
      {/* The scrim is a sibling of the panel, not its parent, so the panel's
          own blur reaches the page behind it. */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="glass border-osrs-bronze/40 shadow-osrs-pop relative h-full w-full max-w-xl overflow-y-auto border-l p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-osrs-parchment-dark/60 text-xs uppercase">{periodLabel(stats.period)}</div>
            <h2 className="text-osrs-gold text-xl font-bold">{memberName(stats, playerId)}</h2>
            <Link href={`/players/${playerId}` as Route} className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-xs">
              Full profile ↗
            </Link>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        {row && (
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {columns
              .filter((c) => Number(row[c.key] ?? 0) > 0)
              .map((c) => {
                const rank = d.rankOf(c.key);
                return (
                  <div key={c.key} className="border-osrs-bronze/25 rounded-lg border p-2">
                    <div className="text-osrs-parchment-dark/60 text-xs">{c.label}</div>
                    <div className="text-osrs-gold font-semibold tabular-nums">{formatStat(row[c.key] as number, c.unit)}</div>
                    {rank && <div className="text-osrs-parchment-dark/50 text-xs">#{rank} in the clan</div>}
                  </div>
                );
              })}
          </div>
        )}
        {row && !row.active && <p className="text-osrs-parchment-dark/60 mb-4 text-sm">No tracked activity this period.</p>}

        {d.skills.length > 0 && (
          <DrawerList title="Skills" rows={d.skills.map((s) => ({ key: s.metric, icon: s.metric, label: s.label, value: `${formatGp(s.xp)} xp`, sub: s.levels ? (stats.kind === "all" ? `level ${s.levels}` : `+${s.levels} levels`) : null }))} />
        )}
        {d.bosses.length > 0 && (
          <DrawerList title="Bosses" rows={d.bosses.map((b) => ({ key: b.metric, icon: b.metric, label: b.label, value: `${b.kills.toLocaleString()} kc`, sub: null }))} />
        )}
        {d.sources.length > 0 && (
          <DrawerList title="Loot by source" rows={d.sources.map((s) => ({ key: String(s.npc_id), icon: null, label: s.name, value: formatGp(s.loot), sub: `${s.drops.toLocaleString()} drops` }))} />
        )}
        {d.items.length > 0 && (
          <div className="mb-4">
            <h3 className="text-osrs-gold mb-2 text-sm font-semibold uppercase">Top items</h3>
            <ul className="grid grid-cols-2 gap-2">
              {d.items.map((it) => (
                <li key={it.item_id} className="border-osrs-bronze/25 flex items-center gap-2 rounded border p-1.5 text-xs">
                  <Sprite id={it.item_id} />
                  <span className="text-osrs-parchment min-w-0 flex-1 truncate">
                    {it.name}
                    {it.quantity > 1 ? ` ×${it.quantity.toLocaleString()}` : ""}
                  </span>
                  <span className="text-osrs-gold tabular-nums">{formatGp(it.loot)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {d.feed.length > 0 && (
          <div>
            <h3 className="text-osrs-gold mb-2 text-sm font-semibold uppercase">Activity</h3>
            <ul className="space-y-1 text-sm">
              {d.feed.slice(0, 60).map((e, i) => (
                <li key={`${e.kind}-${i}`} className="flex gap-2">
                  <span className="text-osrs-parchment-dark/50 w-14 shrink-0 text-xs">{shortDate(e.date)}</span>
                  <span className="text-osrs-parchment-dark/85 min-w-0 flex-1">
                    {e.text}
                    {e.detail && <span className="text-osrs-parchment-dark/50"> · {e.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {stats.coverage.wom !== "stored" && stats.coverage.wom !== "live" && (
          <p className="text-osrs-parchment-dark/45 mt-4 text-xs">
            <Badge size="sm">Note</Badge> XP and kill counts come from Wise Old Man and may be missing for this period.
          </p>
        )}
      </div>
    </div>
  );
}

function DrawerList({ title, rows }: { title: string; rows: { key: string; icon: string | null; label: string; value: string; sub: string | null }[] }) {
  return (
    <div className="mb-4">
      <h3 className="text-osrs-gold mb-2 text-sm font-semibold uppercase">{title}</h3>
      <ul className="space-y-1">
        {rows.slice(0, 25).map((r) => (
          <li key={r.key} className="flex items-center gap-2 text-sm">
            {r.icon ? <MetricIcon metric={r.icon} /> : null}
            <span className="text-osrs-parchment min-w-0 flex-1 truncate">{r.label}</span>
            {r.sub && <span className="text-osrs-parchment-dark/50 text-xs">{r.sub}</span>}
            <span className="text-osrs-gold tabular-nums">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
