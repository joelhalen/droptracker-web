import type { Recap } from "@droptracker/api-types";
import { formatGp } from "@/lib/format";
import { RECAP_CARD_CSS } from "./recap-card.styles";

/**
 * The recap poster — one component rendered in two places:
 *
 *   /groups/{id}/recap/{period}                  the permanent public page
 *   /recap-image/{scope}/{id}/{period}           the chrome-less screenshot route
 *
 * Sharing it is the point: the PNG posted to Discord is pixel-identical to the
 * page the link opens, so the image can never drift from the artifact it
 * advertises. Same reason /board-image mounts the real board components.
 *
 * It is built as an **artifact, not a page**: a fixed-proportion framed poster
 * with its own frozen palette (see recap-card.styles.ts), because most people will
 * only ever meet it as a 550px-wide image in a Discord channel. Everything is
 * sized off a single `--u` unit so the page renders the identical composition at
 * whatever width it's given — `fluid` turns that on for the public page, and the
 * capture route pins it to 1100px.
 *
 * The governing content rule everywhere below is **omit, never zero**. Several
 * sources only started being captured partway through the tracked history (pets
 * from 2026-01, quests from 2026-02, deaths from 2026-07, diaries not yet), and
 * the NPC rollup had a 202509-202606 hole. A card that prints "0 pets" states a
 * falsehood about the player rather than a fact about our pipeline — and one
 * number a reader can disprove discredits every number beside it. So sections,
 * stat plaques and milestones are all *dropped* when their source is empty and
 * the layout closes over the gap, rather than rendering a zero.
 */

/**
 * The poster's width in design units — `width: calc(var(--u) * 68.75)` in
 * recap-card.styles.ts, i.e. 1100px at the default `--u: 16px`. A fixed-width
 * render must derive `--u` from this, or it sizes a 1100px composition into a
 * narrower box and the hero plaques overflow the frame.
 */
const CARD_UNITS = 68.75;

const PERIOD_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const WEEKDAYS = ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"];

export function formatPeriod(period: string): string {
  if (period.length === 4) return period;
  const [year, month] = period.split("-");
  const name = PERIOD_MONTHS[Number(month) - 1];
  return name ? `${name} ${year}` : period;
}

/** "2025-06" → "May" — the month a delta is measured against. */
function previousMonthName(period: string): string | null {
  if (period.length !== 7) return null;
  const month = Number(period.split("-")[1]);
  if (!Number.isFinite(month)) return null;
  return PERIOD_MONTHS[(month + 10) % 12] ?? null;
}

/** Ordinal suffix, so "34th of 223" reads naturally rather than "34 / 223". */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const suffix = ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}

/**
 * "2026-07-29T18:46:13" → "29 Jul 2026", read straight off the string.
 *
 * Snapshot and drop timestamps are stored naive (no offset), and
 * `new Date("...T18:46:13")` is specified to interpret that as *local* time — so
 * going through Date would silently shift the printed day by one wherever the
 * rendering process isn't on UTC, and the page and the PNG could disagree.
 */
function formatIsoDay(iso: string, withYear = false): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const month = MONTHS_SHORT[Number(m[2]) - 1];
  if (!month) return null;
  return withYear ? `${Number(m[3])} ${month} ${m[1]}` : `${Number(m[3])} ${month}`;
}

function argmax(values: number[]): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i]! > values[best]!) best = i;
  return best;
}

const ACHIEVEMENT_LABELS: Record<string, string> = {
  pbs: "Personal bests",
  clog_slots: "Log slots",
  cas: "Combat achievements",
  pets: "Pets",
  quests: "Quests",
  diaries: "Diaries",
  deaths: "Deaths",
};

const SUPERLATIVE_LABELS: Record<string, string> = {
  most_pbs: "Most personal bests",
  most_clog_slots: "Most log slots",
  most_cas: "Most combat achv.",
  most_pets: "Most pets",
  most_deaths: "Most deaths",
};

/* ── small presentational pieces ─────────────────────────────────────────── */

/** Ornamental diamond-flanked rule. */
function Ornament() {
  return (
    <div className="dtrc-orn" aria-hidden>
      <i />
      <b />
      <i />
    </div>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="dtrc-ptitle">
      <span>{children}</span>
      <i aria-hidden />
    </div>
  );
}

/**
 * `grow` marks a panel whose content can absorb vertical slack — a row list
 * spreads its rows out and still looks deliberate, where a grid of milestone
 * tiles stretched to fill 400px does not. Only these are allowed to stretch to
 * square off a column.
 */
function Panel({
  title,
  grow = false,
  children,
}: {
  title: string;
  grow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`dtrc-panel${grow ? " dtrc-panel-grow" : ""}`}>
      <PanelTitle>{title}</PanelTitle>
      {children}
    </section>
  );
}

/**
 * Plain <img> rather than `ItemDbIcon`: the poster is captured by headless
 * chromium, which blocks on outstanding images, so nothing here may be
 * `loading="lazy"`. Height-constrained with auto width because item sprites
 * aren't square (36×32) and squashing them to a box is visible at this size.
 */
function ItemSprite({ id, className }: { id: number | null | undefined; className?: string }) {
  if (id == null) return null;
  return <img src={`/img/itemdb/${id}.png`} alt="" className={className} />;
}

/**
 * Who received an item, when that can be said honestly.
 *
 * Three states, and the distinction is the whole point:
 *
 *   sole receiver     → the name. "Buzzyn" got the Imbued heart.
 *   shared           → "Buzzyn +10" — they got the most of it by value, but not
 *                      all of it, and the suffix says so rather than implying
 *                      otherwise.
 *   unattributable   → nothing at all. Player cards strip attribution (every
 *                      item was the subject's), and the annual fold drops it when
 *                      two months disagree on who got a thing.
 *
 * Rendering nothing is a deliberate outcome, not a fallback: the clanmates
 * reading this card know who got what, and a name they can disprove costs more
 * than a blank line. Same reasoning as the omit-never-zero rule above.
 */
function ReceiverLine({ entry }: { entry: Recap["top_items"][number] }) {
  if (!entry.receiver) return null;
  const shared = (entry.receivers ?? 1) > 1;
  return (
    <span className="dtrc-slot-who">
      <b>{entry.receiver.name}</b>
      {shared ? ` +${(entry.receivers ?? 1) - 1}` : null}
    </span>
  );
}

/**
 * The line under a rank figure.
 *
 * A bare "of 4,812 tracked" is the weakest thing that space can say. On a player
 * card the same two numbers make a percentile, which is the most shareable line
 * on the poster, and last month's placing turns a static number into a
 * trajectory. Both placings are stated rather than differenced: the board grows
 * every month, so "up 40 places" can be false for a player who never moved.
 */
function rankHint(rank: NonNullable<Recap["rank"]>, isGroup: boolean): string | undefined {
  const parts: string[] = [];
  // Percentile only where it flatters honestly: on a small board "top 45%" is
  // noise, and the backend rounds to a tenth so tiny boards read as 12.5%.
  if (!isGroup && rank.percentile != null && rank.of && rank.of >= 100 && rank.percentile <= 50) {
    parts.push(`Top ${rank.percentile}%`);
  } else if (rank.of) {
    parts.push(`of ${rank.of.toLocaleString()} tracked`);
  }
  if (!isGroup && rank.previous_position) {
    parts.push(`was ${ordinal(rank.previous_position)}`);
  }
  return parts.length > 0 ? parts.join("  ·  ") : undefined;
}

function MiniStat({
  label,
  value,
  hint,
  delta,
  deltaVs,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Percent movement against the previous period. Null renders no chip. */
  delta?: number | null;
  deltaVs?: string;
}) {
  return (
    <div className="dtrc-plaque dtrc-mini">
      <div className="dtrc-lbl">{label}</div>
      <div className="dtrc-mini-num">{value}</div>
      {delta !== null && delta !== undefined ? (
        <div className={`dtrc-chip ${delta >= 0 ? "dtrc-chip-up" : "dtrc-chip-down"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs {deltaVs}
        </div>
      ) : hint ? (
        <div className="dtrc-mini-hint">{hint}</div>
      ) : null}
    </div>
  );
}

/* ── the poster ──────────────────────────────────────────────────────────── */

export function RecapCard({
  recap,
  width,
  fluid = false,
  layout = "auto",
}: {
  recap: Recap;
  /** Explicit CSS width. Omit on the capture route, which sizes its wrapper. */
  width?: number;
  /** Scale to the parent's width (public page) instead of a fixed 1100px. */
  fluid?: boolean;
  /**
   * Force a body shape instead of letting the data pick one (see the
   * composition note below). Only for side-by-side previews of the same period
   * — `?layout=` on the capture route. Production leaves this `auto`.
   */
  layout?: "auto" | "stacked" | "columns";
}) {
  const { totals, rank, subject } = recap;
  const isGroup = recap.scope === "group";
  const isAnnual = recap.period.length === 4;
  const loot = totals.loot ?? totals.loot_rollup ?? 0;

  // Month-over-month movement. Only shown when there IS a previous figure —
  // "+100%" against a zero baseline is noise, not a story.
  const prev = rank?.previous_loot ?? 0;
  const delta = prev > 0 ? Math.round(((loot - prev) / prev) * 100) : null;
  const prevLabel = isAnnual ? "previous year" : (previousMonthName(recap.period) ?? "previous");

  // Efficient hours bossed, on the same terms as the loot figure: absent unless
  // it was harvested, and no movement chip without a real baseline to move from.
  const ehb = totals.ehb;
  const prevEhb = totals.previous_ehb ?? 0;
  const ehbDelta =
    ehb !== undefined && prevEhb > 0 ? Math.round(((ehb - prevEhb) / prevEhb) * 100) : null;

  const npcAvailable = recap.npc_data_available !== false && recap.top_npcs.length > 0;
  const items = recap.top_items.slice(0, 10);

  // Zero counts are dropped here rather than in the sources — see the header.
  const achievements = Object.entries(recap.achievements ?? {}).filter(([, n]) => n > 0);
  const superlatives = Object.entries(recap.superlatives ?? {}).filter(
    ([, v]) => v && v.count > 0,
  );
  const members = isGroup ? (recap.top_members ?? []).slice(0, 5) : [];
  const byMonth = recap.by_month ?? [];
  const clans = isGroup ? [] : (subject?.groups ?? []);

  // Loot-weighted histograms: an unused-until-now field that carries the single
  // most characterful line on the card. Omitted when the period has no rows at
  // all rather than claiming everyone loots at midnight on a Monday.
  const byHour = recap.activity?.by_hour ?? [];
  const byWeekday = recap.activity?.by_weekday ?? [];
  const hourTotal = byHour.reduce((a, b) => a + b, 0);
  const primeHour = byHour.length === 24 && hourTotal > 0 ? argmax(byHour) : null;
  const primeDay =
    byWeekday.length === 7 && byWeekday.reduce((a, b) => a + b, 0) > 0 ? argmax(byWeekday) : null;

  /* Stat plaques beside the hero figure. Built as a list so an unavailable one
     simply isn't there and the grid closes up. */
  const minis: React.ReactNode[] = [];
  if (totals.drops) {
    minis.push(<MiniStat key="drops" label="Drops" value={totals.drops.toLocaleString()} />);
  }
  if (totals.unique_items) {
    minis.push(
      <MiniStat key="uniq" label="Unique items" value={totals.unique_items.toLocaleString()} />,
    );
  }
  if (rank?.position) {
    minis.push(
      <MiniStat
        key="rank"
        label={isGroup ? "Clan rank" : "Global rank"}
        value={ordinal(rank.position)}
        hint={rankHint(rank, isGroup)}
      />,
    );
  } else if (totals.members_active) {
    minis.push(
      <MiniStat
        key="members"
        label="Members looting"
        value={totals.members_active.toLocaleString()}
        hint={totals.members_total ? `of ${totals.members_total.toLocaleString()}` : undefined}
      />,
    );
  }
  if (recap.peak_month) {
    const month = Number(recap.peak_month.period.split("-")[1]);
    minis.push(
      <MiniStat
        key="peak"
        label="Best month"
        value={MONTHS_SHORT[month - 1] ?? recap.peak_month.period}
        hint={formatGp(recap.peak_month.loot)}
      />,
    );
  }
  // Ahead of Prime time and Sources in the queue: hours bossed is a headline
  // number people compare month to month, where those two are flavour. Placed
  // after Best month so it can never push that unguarded tile into a 5th slot.
  if (ehb !== undefined && ehb > 0 && minis.length < 4) {
    minis.push(
      <MiniStat
        key="ehb"
        label="EHB gained"
        value={ehb.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        delta={ehbDelta}
        deltaVs={prevLabel}
        hint="efficient hours bossed"
      />,
    );
  }
  if (primeHour !== null && minis.length < 4) {
    minis.push(
      <MiniStat
        key="prime"
        label="Prime time"
        value={`${String(primeHour).padStart(2, "0")}:00 UTC`}
        hint={primeDay !== null ? WEEKDAYS[primeDay] : undefined}
      />,
    );
  }
  if (!totals.unique_items && totals.unique_npcs && minis.length < 4) {
    minis.push(
      <MiniStat key="npcs" label="Sources" value={totals.unique_npcs.toLocaleString()} />,
    );
  }

  /* ── panels ────────────────────────────────────────────────────────────── */
  const gallery =
    items.length > 0 ? (
      <Panel key="gallery" title={isAnnual ? "Loot of the year" : "Loot gallery"}>
        <div className="dtrc-gal">
          {items.map((item) => (
            <div className="dtrc-slot" key={item.item_id ?? item.name}>
              {item.quantity && item.quantity > 1 ? (
                <span className="dtrc-slot-q">&times;{item.quantity.toLocaleString()}</span>
              ) : null}
              <span className="dtrc-slot-img">
                <ItemSprite id={item.item_id} />
              </span>
              <span className="dtrc-slot-val">{formatGp(item.loot)}</span>
              <span className="dtrc-slot-name">{item.name}</span>
              <ReceiverLine entry={item} />
            </div>
          ))}
        </div>
      </Panel>
    ) : null;

  const monthBars =
    byMonth.length > 1 ? (
      <Panel key="months" title="Month by month">
        <MonthBars months={byMonth} peak={recap.peak_month?.period} />
      </Panel>
    ) : null;

  const topNpcs = recap.top_npcs.slice(0, 5);
  const npcMax = Math.max(...topNpcs.map((n) => n.loot), 1);
  const sources = npcAvailable ? (
    <Panel key="sources" title="Top sources" grow>
      <div className="dtrc-rows">
        {topNpcs.map((npc) => (
          <div className="dtrc-row" key={npc.npc_id ?? npc.name}>
            <span className="dtrc-row-fill" style={{ width: `${(npc.loot / npcMax) * 100}%` }} />
            <span className="dtrc-row-name">{npc.name}</span>
            {npc.kills ? (
              <span className="dtrc-row-sub">{npc.kills.toLocaleString()} kc</span>
            ) : null}
            <span className="dtrc-row-val">{formatGp(npc.loot)}</span>
          </div>
        ))}
      </div>
    </Panel>
  ) : null;

  const memberMax = Math.max(...members.map((m) => m.loot), 1);
  const memberPanel =
    members.length > 0 ? (
      <Panel key="members" title="Top members" grow>
        <div className="dtrc-rows">
          {members.map((member, i) => (
            <div className="dtrc-row" key={member.player_id}>
              <span
                className="dtrc-row-fill"
                style={{ width: `${(member.loot / memberMax) * 100}%` }}
              />
              <span className={`dtrc-rank${i < 3 ? ` dtrc-rank-${i + 1}` : ""}`}>{i + 1}</span>
              <span className="dtrc-row-name">{member.name ?? "Unknown"}</span>
              <span className="dtrc-row-val">{formatGp(member.loot)}</span>
            </div>
          ))}
        </div>
      </Panel>
    ) : null;

  const standouts =
    superlatives.length > 0 ? (
      <Panel key="standouts" title="Standouts" grow>
        <div className="dtrc-rows">
          {superlatives.map(([key, value]) => (
            <div className="dtrc-row" key={key}>
              <span className="dtrc-row-name">
                {value!.name ?? "Unknown"}
                <span className="dtrc-row-sub"> · {SUPERLATIVE_LABELS[key] ?? key}</span>
              </span>
              <span className="dtrc-row-val">{value!.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Panel>
    ) : null;

  const milestones =
    achievements.length > 0 ? (
      <Panel key="milestones" title="Milestones">
        <div className="dtrc-mstones">
          {achievements.map(([key, count]) => (
            <div className="dtrc-mstone" key={key}>
              <div className="dtrc-mstone-num">{count.toLocaleString()}</div>
              <div className="dtrc-mstone-lbl">{ACHIEVEMENT_LABELS[key] ?? key}</div>
            </div>
          ))}
        </div>
      </Panel>
    ) : null;

  /* Composition. Which panels exist varies enormously — a clan month has
     members and standouts, an annual fold has neither but has twelve months of
     history, a player card has neither and no month bars — so rather than
     distribute panels generically (which left the annual card with one tile
     stretched down an empty 400px column) the poster picks between two shapes:

       two-column  when there ARE per-member panels: gallery + sources left,
                   the member rail right, the way the concept art reads.
       banded      otherwise: every panel full width, one under the next. Pairing
                   two panels side by side looked tempting but the grid stretches
                   both to the taller one's height, so five rows of sources beside
                   three milestone tiles left a hollow bordered box. Full-width
                   bands also give the row text more room, which is what makes
                   them readable at Discord's ~550px embed width.  */
  const rail = [memberPanel, standouts].filter(Boolean);
  const sideCandidates = [...rail, milestones].filter(Boolean);
  /* `layout` overrides the choice for previews. Forcing two columns still needs
     something to put in the rail, so it degrades to banded rather than drawing
     an empty column. */
  const twoColumn =
    layout === "stacked"
      ? false
      : layout === "columns"
        ? sideCandidates.length > 0
        : rail.length > 0;

  const wide: React.ReactNode[] = [];
  const side: React.ReactNode[] = [];
  const stack: React.ReactNode[] = [];

  if (twoColumn) {
    if (gallery) wide.push(gallery);
    if (monthBars) wide.push(monthBars);
    if (sources) wide.push(sources);
    side.push(...sideCandidates);
  } else {
    if (gallery) stack.push(gallery);
    if (monthBars) stack.push(monthBars);
    if (sources) stack.push(sources);
    stack.push(...rail);
    if (milestones) stack.push(milestones);
  }

  const drop = recap.biggest_drop;
  const dropDay = drop?.date ? formatIsoDay(drop.date) : null;

  // Every figure on the card was frozen at this moment; saying so is what makes a
  // permanent archive URL defensible when the live numbers have since moved on.
  const stamp = recap.generated_at ? formatIsoDay(recap.generated_at, true) : null;

  return (
    <div className={fluid ? "dtrc-fit" : undefined}>
      <style dangerouslySetInnerHTML={{ __html: RECAP_CARD_CSS }} />
      <div
        className="dtrc"
        style={
          width
            ? ({ width, "--u": `${width / CARD_UNITS}px` } as React.CSSProperties)
            : undefined
        }
      >
        <div className="dtrc-in">
          <div className="dtrc-lamp dtrc-lamp-l" aria-hidden />
          <div className="dtrc-lamp dtrc-lamp-r" aria-hidden />
          <span className="dtrc-cnr dtrc-cnr-tl" aria-hidden />
          <span className="dtrc-cnr dtrc-cnr-tr" aria-hidden />
          <span className="dtrc-cnr dtrc-cnr-bl" aria-hidden />
          <span className="dtrc-cnr dtrc-cnr-br" aria-hidden />

          <header className="dtrc-hd">
            <div className="dtrc-eyebrow">
              {isGroup ? "Clan" : "Player"} {isAnnual ? "year in review" : "recap"}
            </div>
            <h1 className="dtrc-title">
              {subject?.name ?? (isGroup ? `Group ${subject?.id}` : `Player ${subject?.id}`)}
            </h1>
            <div className="dtrc-period">{formatPeriod(recap.period)}</div>
            {/* Whose clan this player runs with — the one line of context a
                personal card can add that the player didn't already know it
                would say. Omitted for the clanless rather than left blank. */}
            {clans.length > 0 && (
              <div className="dtrc-clans">{clans.map((g) => g.name).join("  ·  ")}</div>
            )}
          </header>

          <Ornament />

          <div className="dtrc-hero">
            <div className="dtrc-plaque dtrc-hero-main">
              <div className="dtrc-lbl">Total loot</div>
              <div className="dtrc-hero-num">{formatGp(loot)}</div>
              <div className="dtrc-hero-exact">{loot.toLocaleString()} gp</div>
              {delta !== null && (
                <div className={`dtrc-chip ${delta >= 0 ? "dtrc-chip-up" : "dtrc-chip-down"}`}>
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs {prevLabel}
                </div>
              )}
            </div>
            {minis.length > 0 && (
              <div
                className="dtrc-hero-side"
                style={{
                  gridTemplateColumns: `repeat(${minis.length === 4 ? 2 : minis.length}, 1fr)`,
                }}
              >
                {minis}
              </div>
            )}
          </div>

          {twoColumn ? (
            <div className="dtrc-body dtrc-body-2">
              <div className="dtrc-col">{wide}</div>
              <div className="dtrc-col">{side}</div>
            </div>
          ) : (
            <div className="dtrc-body">{stack}</div>
          )}

          {drop && (
            <div className="dtrc-feat">
              <div className="dtrc-feat-slot">
                <ItemSprite id={drop.item_id} />
              </div>
              <div className="dtrc-feat-mid">
                <div className="dtrc-lbl">{isAnnual ? "Drop of the year" : "Drop of the month"}</div>
                <div className="dtrc-feat-name">{drop.item_name ?? "Unknown item"}</div>
                <div className="dtrc-feat-meta">
                  {[
                    isGroup && drop.player_name ? drop.player_name : null,
                    drop.npc_name ?? null,
                    // Only meaningful from web76a onward; older drops have no KC.
                    drop.kill_count !== null ? `${drop.kill_count.toLocaleString()} kc` : null,
                    dropDay,
                  ]
                    .filter(Boolean)
                    .join("  ·  ")}
                </div>
              </div>
              <div className="dtrc-feat-val">
                <b>{formatGp(drop.total_value)}</b>
                <span className="dtrc-row-sub">{drop.total_value.toLocaleString()} gp</span>
              </div>
              {/* The proof screenshot — the one thing no hiscores-derived tracker
                  can put on a card. Frozen at generation time; the pruner
                  deletes sub-1M screenshots at 30d, so it's often absent. */}
              {drop.image_url && (
                <div className="dtrc-feat-proof">
                  <img src={drop.image_url} alt="" />
                </div>
              )}
            </div>
          )}

          <footer className="dtrc-ft">
            <span className="dtrc-ft-brand">DropTracker.io</span>
            <span className="dtrc-ft-note">
              {recap.npc_data_available === false
                ? "Source breakdown unavailable for this period"
                : isAnnual && recap.npc_months_covered !== undefined && recap.npc_months_covered < byMonth.length
                  ? `Sources from ${recap.npc_months_covered} of ${byMonth.length} months`
                  : ""}
            </span>
            <span className="dtrc-ft-right">
              {stamp ? `Snapshot taken ${stamp}` : "DropTracker recap"}
            </span>
          </footer>
        </div>
      </div>
    </div>
  );
}

function MonthBars({
  months,
  peak,
}: {
  months: { period: string; loot: number }[];
  peak?: string;
}) {
  const max = Math.max(...months.map((m) => m.loot), 1);
  return (
    <div className="dtrc-bars">
      {months.map((m) => {
        const month = Number(m.period.split("-")[1]);
        const isPeak = m.period === peak;
        return (
          <div className="dtrc-bar" key={m.period}>
            {/* The fill is a percentage of `.dtrc-bar-track`, NOT of the whole
                column. Sizing it against the column made every tall bar wrong:
                the month label is a flex sibling, so a fill asking for 95% or
                100% overflowed and got *shrunk* to fit, while a 50% bar was
                left alone. September (the year's peak, 100%) drew 58.8px where
                May (94.7%) drew 74px — the highlighted month rendered shorter
                than the month it beat. The track is the plot area and nothing
                else lives in it, so percentages are exact and comparable. */}
            <div className="dtrc-bar-track">
              <div
                className={`dtrc-bar-fill${isPeak ? " dtrc-bar-peak" : ""}`}
                // Floored so an active-but-small month is still visibly present
                // rather than a hairline.
                style={{ height: `${Math.max(6, (m.loot / max) * 100)}%` }}
              >
                {/* Inside the fill and out of flow, anchored to its top edge, so
                    labelling the peak can't change the height it labels. */}
                {isPeak && <span className="dtrc-bar-peak-val">{formatGp(m.loot)}</span>}
              </div>
            </div>
            <div className="dtrc-bar-lbl">{MONTHS_SHORT[month - 1] ?? m.period}</div>
          </div>
        );
      })}
    </div>
  );
}
