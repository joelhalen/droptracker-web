"use client";

/**
 * The profile's Overview tab: what the account has been doing lately.
 *
 * Two columns, after Wise Old Man's player page: a dated feed of recent
 * achievements, and what was gained over the last day, week or month. The
 * difference is the source. Everything here comes from what the plugin
 * tracked — loot value, kills with drops, collection log slots, combat
 * achievements, personal bests — which a hiscores snapshot cannot see.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  OVERVIEW_PERIODS,
  PlayerWomGainsSchema,
  type OverviewPeriod,
  type PlayerActivityItem,
  type PlayerOverview,
  type PlayerWomGains,
} from "@droptracker/api-types";
import { formatRelativeTime } from "@/lib/format";
import { entityPath } from "@/lib/slug";
import { caTierIcon, compactNumber, rebaseImg, skillLabel } from "@/lib/player-progress";

const PERIOD_LABEL: Record<OverviewPeriod, string> = { day: "Day", week: "Week", month: "Month" };
const PERIOD_PHRASE: Record<OverviewPeriod, string> = {
  day: "the last 24 hours",
  week: "the last 7 days",
  month: "the last 30 days",
};

const TYPE_LABEL: Record<string, { label: string; tone: string }> = {
  drop: { label: "Drop", tone: "text-osrs-gp-green" },
  clog: { label: "Collection log", tone: "text-sky-300" },
  pb: { label: "Personal best", tone: "text-osrs-gold-bright" },
  ca: { label: "Combat achievement", tone: "text-orange-300" },
  quest: { label: "Quest", tone: "text-cyan-300" },
  pet: { label: "Pet", tone: "text-pink-300" },
  level: { label: "Level", tone: "text-osrs-green" },
  total_level: { label: "Total level", tone: "text-osrs-green" },
  kc: { label: "Kill count", tone: "text-purple-300" },
};

export type ProfileOverviewEmbed = { imgBase: string; links: boolean };

function itemIcon(item: PlayerActivityItem, imgBase: string): string | null {
  if (item.type === "ca") return caTierIcon(item.tier) ?? "/osrs/ca.png";
  if (item.type === "quest") return "/osrs/quest.png";
  return rebaseImg(item.icon_url, imgBase);
}

function itemHref(item: PlayerActivityItem): Route | null {
  if ((item.type === "drop" || item.type === "clog" || item.type === "pet") && item.item_id) {
    return entityPath("items", item.item_id, item.title) as Route;
  }
  if ((item.type === "pb" || item.type === "kc") && item.npc_id) {
    return `/npcs/${item.npc_id}` as Route;
  }
  return null;
}

function Feed({ items, embed }: { items: PlayerActivityItem[]; embed: ProfileOverviewEmbed }) {
  const [shown, setShown] = useState(12);
  if (items.length === 0) {
    return (
      <p className="text-osrs-parchment-dark/60 px-3 py-6 text-center text-sm">
        Nothing tracked yet. Drops, collection log slots, personal bests and combat achievements
        show up here as the plugin reports them.
      </p>
    );
  }
  return (
    <div>
      <ol className="divide-osrs-bronze/15 divide-y">
        {items.slice(0, shown).map((item, index) => {
          const icon = itemIcon(item, embed.imgBase);
          const meta = TYPE_LABEL[item.type];
          const href = embed.links ? itemHref(item) : null;
          const title = (
            <span className="font-osrs text-osrs-parchment text-[15px] leading-tight">{item.title}</span>
          );
          return (
            <li key={`${item.type}-${item.ts}-${index}`} className="flex items-center gap-3 px-3 py-2">
              <span className="bg-osrs-surface-3/60 flex size-9 shrink-0 items-center justify-center rounded">
                {icon ? (
                  <img
                    src={icon}
                    alt=""
                    loading="lazy"
                    className="max-h-7 max-w-7 object-contain [image-rendering:pixelated]"
                  />
                ) : (
                  <span aria-hidden className="text-osrs-gold/70 text-sm">
                    ★
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  {href ? (
                    <Link href={href} className="hover:text-osrs-gold-bright transition-colors">
                      {title}
                    </Link>
                  ) : (
                    title
                  )}
                  {item.value && item.value.value > 0 && (
                    <span className="text-osrs-gp-green text-xs tabular-nums">
                      {item.value.value_formatted} gp
                    </span>
                  )}
                </div>
                <div className="text-xs">
                  {meta && <span className={meta.tone}>{meta.label}</span>}
                  {item.detail && item.detail !== meta?.label && (
                    <span className="text-osrs-parchment-dark/60">
                      {meta ? " · " : ""}
                      {item.detail.replace(/^(New collection log slot|Quest complete|Drop)( · )?/, "") ||
                        item.detail}
                    </span>
                  )}
                </div>
              </div>
              <time
                dateTime={new Date(item.ts * 1000).toISOString()}
                title={new Date(item.ts * 1000).toLocaleString()}
                className="text-osrs-parchment-dark/50 shrink-0 text-xs tabular-nums"
                suppressHydrationWarning
              >
                {formatRelativeTime(item.ts)}
              </time>
            </li>
          );
        })}
      </ol>
      {items.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + 12)}
          className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright w-full py-2 text-xs tracking-wide uppercase transition-colors"
        >
          Show more
        </button>
      )}
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const zero = value === "0";
  return (
    <div className="border-osrs-bronze/25 bg-osrs-surface-2/60 rounded border px-2.5 py-2">
      <div className="text-osrs-parchment-dark/60 text-[10.5px] tracking-wide uppercase">{label}</div>
      <div
        className={`font-osrs text-lg leading-tight tabular-nums ${
          zero ? "text-osrs-parchment-dark/40" : (tone ?? "text-osrs-gold-bright")
        }`}
      >
        {zero ? "0" : `+${value}`}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-osrs-parchment-dark/60 mt-4 mb-1.5 text-[11px] tracking-wide uppercase">
      {children}
    </div>
  );
}

function SkillGains({
  skills,
  imgBase,
}: {
  skills: Record<string, number>;
  imgBase: string;
}) {
  const rows = Object.entries(skills)
    .filter(([, gained]) => gained > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  if (rows.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
      {rows.map(([skill, gained]) => (
        <li key={skill} className="flex items-center gap-2 text-sm">
          <img
            src={`${imgBase}/metrics/${skill}.png`}
            alt=""
            className="size-4 shrink-0 object-contain [image-rendering:pixelated]"
          />
          <span className="text-osrs-parchment/90 truncate">{skillLabel(skill)}</span>
          <span className="text-osrs-green ml-auto tabular-nums">+{compactNumber(gained)}</span>
        </li>
      ))}
    </ul>
  );
}

export function ProfileOverview({
  playerId,
  overview,
  embed,
}: {
  playerId: number;
  overview: PlayerOverview;
  embed: ProfileOverviewEmbed;
}) {
  const [period, setPeriod] = useState<OverviewPeriod>("week");
  const gains = overview.gains[period];
  const xp = overview.skills.gains[period];

  // Wise Old Man fills in XP and boss kills where our own history cannot,
  // when the backend has that lookup on. One request per period, kept.
  const [wom, setWom] = useState<Partial<Record<OverviewPeriod, PlayerWomGains | null>>>({});
  const wantWom = overview.wom_gains_enabled && xp == null && wom[period] === undefined;
  useEffect(() => {
    if (!wantWom) return;
    let cancelled = false;
    fetch(`/api/players/${playerId}/wom-gains?period=${period}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const parsed = body ? PlayerWomGainsSchema.safeParse(body) : null;
        if (!cancelled) setWom((prev) => ({ ...prev, [period]: parsed?.success ? parsed.data : null }));
      })
      .catch(() => {
        if (!cancelled) setWom((prev) => ({ ...prev, [period]: null }));
      });
    return () => {
      cancelled = true;
    };
  }, [wantWom, playerId, period]);
  const womGains = xp == null && wom[period]?.available ? wom[period] : null;

  const topLoot = gains.top_npcs[0]?.loot.value ?? 0;
  const xpTotal = xp?.total ?? womGains?.total_xp ?? null;

  return (
    <div className="grid lg:grid-cols-2">
      <section className="border-osrs-bronze/25 border-b lg:border-r lg:border-b-0">
        <h3 className="font-osrs text-osrs-gold-bright border-osrs-bronze/25 border-b px-3 py-2 text-base">
          Recent achievements
        </h3>
        <div className="max-h-[32rem] overflow-y-auto">
          <Feed items={overview.activity} embed={embed} />
        </div>
      </section>

      <section>
        <div className="border-osrs-bronze/25 flex items-center justify-between gap-3 border-b px-3 py-1.5">
          <h3 className="font-osrs text-osrs-gold-bright text-base">Gained</h3>
          <div className="border-osrs-bronze/40 flex overflow-hidden rounded border" role="group" aria-label="Period">
            {OVERVIEW_PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={`px-2.5 py-1 text-xs transition-colors ${
                  period === p
                    ? "bg-osrs-bronze/40 text-osrs-gold-bright"
                    : "text-osrs-parchment-dark/70 hover:bg-osrs-bronze/15"
                }`}
              >
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Figure
              label="Loot"
              value={gains.loot.value > 0 ? `${gains.loot.value_formatted} gp` : "0"}
              tone="text-osrs-gp-green"
            />
            <Figure label="Drops" value={gains.drops.toLocaleString("en-US")} />
            <Figure label="XP" value={xpTotal ? compactNumber(xpTotal) : "0"} tone="text-osrs-green" />
            <Figure label="Log slots" value={String(gains.clog)} />
            <Figure label="Combat tasks" value={String(gains.combat_achievements)} />
            <Figure label="Personal bests" value={String(gains.personal_bests)} />
          </div>
          {(gains.quests > 0 || gains.pets > 0) && (
            <p className="text-osrs-parchment-dark/70 mt-2 text-xs">
              {[
                gains.quests > 0 ? `${gains.quests} quest${gains.quests === 1 ? "" : "s"} completed` : null,
                gains.pets > 0 ? `${gains.pets} new pet${gains.pets === 1 ? "" : "s"}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          {gains.top_npcs.length > 0 && (
            <>
              <SectionLabel>Most loot from</SectionLabel>
              <ul className="space-y-1.5">
                {gains.top_npcs.map((npc) => {
                  const icon = rebaseImg(npc.icon_url, embed.imgBase);
                  const name = <span className="truncate">{npc.name}</span>;
                  return (
                    <li key={npc.npc_id} className="text-sm">
                      <div className="flex items-center gap-2">
                        {icon && (
                          <img
                            src={icon}
                            alt=""
                            loading="lazy"
                            className="size-5 shrink-0 object-contain [image-rendering:pixelated]"
                          />
                        )}
                        {embed.links ? (
                          <Link
                            href={`/npcs/${npc.npc_id}` as Route}
                            className="hover:text-osrs-gold-bright min-w-0 truncate transition-colors"
                          >
                            {name}
                          </Link>
                        ) : (
                          name
                        )}
                        <span className="text-osrs-parchment-dark/50 ml-auto shrink-0 text-xs tabular-nums">
                          {npc.drops.toLocaleString("en-US")} drops
                        </span>
                        <span className="text-osrs-gp-green w-16 shrink-0 text-right tabular-nums">
                          {npc.loot.value_formatted}
                        </span>
                      </div>
                      <div className="bg-osrs-surface-3 mt-1 h-1 overflow-hidden rounded-full">
                        <div
                          className="bg-osrs-gold/70 h-full rounded-full"
                          style={{ width: `${topLoot > 0 ? Math.max(2, (npc.loot.value / topLoot) * 100) : 0}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {xp && xp.total > 0 && (
            <>
              <SectionLabel>
                XP gained
                {xp.partial && (
                  <span className="normal-case">
                    {" "}
                    · since {new Date(xp.since * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                )}
              </SectionLabel>
              <SkillGains skills={xp.skills} imgBase={embed.imgBase} />
            </>
          )}

          {womGains && (
            <>
              {womGains.total_xp > 0 && (
                <>
                  <SectionLabel>XP gained · Wise Old Man</SectionLabel>
                  <SkillGains skills={womGains.skills} imgBase={embed.imgBase} />
                </>
              )}
              {womGains.bosses.length > 0 && (
                <>
                  <SectionLabel>Boss kills · Wise Old Man</SectionLabel>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {womGains.bosses.slice(0, 8).map((boss) => {
                      const icon = rebaseImg(boss.icon_url, embed.imgBase);
                      return (
                        <li key={boss.metric} className="flex items-center gap-2 text-sm">
                          {icon && (
                            <img
                              src={icon}
                              alt=""
                              className="size-4 shrink-0 object-contain [image-rendering:pixelated]"
                            />
                          )}
                          <span className="text-osrs-parchment/90 truncate">{boss.name ?? boss.metric}</span>
                          <span className="text-osrs-gold-bright ml-auto tabular-nums">
                            +{boss.kills.toLocaleString("en-US")}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}

          {gains.drops === 0 && !xpTotal && gains.clog + gains.combat_achievements + gains.personal_bests === 0 && (
            <p className="text-osrs-parchment-dark/60 mt-4 text-sm">
              Nothing tracked in {PERIOD_PHRASE[period]}.
            </p>
          )}
          {xp == null && !womGains && overview.skills.has_data && (
            <p className="text-osrs-parchment-dark/50 mt-4 text-xs">
              XP gains appear once the plugin has synced this account on two different days.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
