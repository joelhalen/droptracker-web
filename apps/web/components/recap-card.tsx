import type { Recap } from "@droptracker/api-types";
import { ItemDbIcon } from "@/components/item-db-icon";
import { formatGp } from "@/lib/format";

/**
 * The recap card itself — one component rendered in two places:
 *
 *   /groups/{id}/recap/{period}                  the permanent public page
 *   /recap-image/{scope}/{id}/{period}           the chrome-less screenshot route
 *
 * Sharing it is the point: the PNG posted to Discord is pixel-identical to the
 * page the link opens, so the image can never drift from the artifact it
 * advertises. Same reason /board-image mounts the real board components.
 *
 * The governing rule everywhere below is **omit, never zero**. Several sources
 * only started being captured partway through the tracked history (pets from
 * 2026-01, quests from 2026-02, deaths from 2026-07, diaries not yet), and the
 * NPC rollup has a 202509-202606 hole. A card that prints "0 pets" states a
 * falsehood about the player rather than a fact about our pipeline — and one
 * number a reader can disprove discredits every number beside it.
 */

const PERIOD_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatPeriod(period: string): string {
  if (period.length === 4) return period;
  const [year, month] = period.split("-");
  const name = PERIOD_MONTHS[Number(month) - 1];
  return name ? `${name} ${year}` : period;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-osrs-surface-2/70 rounded-lg px-4 py-3">
      <div className="text-osrs-parchment-dark/60 text-xs tracking-wide uppercase">{label}</div>
      <div className="text-osrs-gold-bright mt-0.5 text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="text-osrs-parchment-dark/50 mt-0.5 text-xs">{hint}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-osrs-parchment/80 mb-2 text-sm font-semibold tracking-wide uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Ordinal suffix, so "34th of 223" reads naturally rather than "34 / 223". */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const suffix = ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${n % 10 <= 3 ? suffix : "th"}`;
}

const ACHIEVEMENT_LABELS: Record<string, string> = {
  pbs: "Personal bests",
  clog_slots: "Collection log slots",
  cas: "Combat achievements",
  pets: "Pets",
  quests: "Quests",
  diaries: "Diaries",
  deaths: "Deaths",
};

const SUPERLATIVE_LABELS: Record<string, string> = {
  most_pbs: "Most personal bests",
  most_clog_slots: "Most log slots",
  most_cas: "Most combat achievements",
  most_pets: "Most pets",
  most_deaths: "Most deaths",
};

export function RecapCard({ recap, width }: { recap: Recap; width?: number }) {
  const { totals, rank, subject } = recap;
  const isGroup = recap.scope === "group";
  const loot = totals.loot ?? totals.loot_rollup ?? 0;

  // Month-over-month movement. Only shown when there IS a previous figure —
  // "+100%" against a zero baseline is noise, not a story.
  const prev = rank?.previous_loot ?? 0;
  const delta = prev > 0 ? Math.round(((loot - prev) / prev) * 100) : null;

  const npcAvailable = recap.npc_data_available !== false && recap.top_npcs.length > 0;

  // Zero counts are dropped here rather than in the sources — see the header.
  const achievements = Object.entries(recap.achievements ?? {}).filter(([, n]) => n > 0);
  const superlatives = Object.entries(recap.superlatives ?? {}).filter(
    ([, v]) => v && v.count > 0,
  );

  return (
    <div style={width ? { width } : undefined} className="text-osrs-parchment">
      <header className="border-osrs-bronze/30 border-b pb-4">
        <div className="text-osrs-parchment-dark/60 text-xs tracking-widest uppercase">
          {isGroup ? "Clan recap" : "Player recap"}
        </div>
        <h1 className="text-osrs-gold-bright mt-1 text-3xl font-bold">
          {subject?.name ?? (isGroup ? `Group ${subject?.id}` : `Player ${subject?.id}`)}
        </h1>
        <div className="text-osrs-parchment-dark/80 text-lg">{formatPeriod(recap.period)}</div>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Total loot"
          value={formatGp(loot)}
          hint={delta !== null ? `${delta >= 0 ? "+" : ""}${delta}% vs previous` : undefined}
        />
        <Stat label="Drops" value={(totals.drops ?? 0).toLocaleString()} />
        <Stat label="Unique items" value={(totals.unique_items ?? 0).toLocaleString()} />
        {rank?.position ? (
          <Stat
            label={isGroup ? "Clan rank" : "Global rank"}
            value={ordinal(rank.position)}
            hint={rank.of ? `of ${rank.of.toLocaleString()}` : undefined}
          />
        ) : totals.members_active !== undefined ? (
          <Stat
            label="Active members"
            value={String(totals.members_active)}
            hint={totals.members_total ? `of ${totals.members_total}` : undefined}
          />
        ) : (
          <Stat label="Unique sources" value={String(totals.unique_npcs ?? 0)} />
        )}
      </div>

      {recap.biggest_drop && (
        <Section title="Biggest drop">
          <div className="bg-osrs-surface-2/70 flex items-center gap-4 rounded-lg p-4">
            <ItemDbIcon itemId={recap.biggest_drop.item_id} size={48} />
            <div className="min-w-0 flex-1">
              <div className="text-osrs-gold-bright truncate text-lg font-semibold">
                {recap.biggest_drop.item_name ?? "Unknown item"}
                {recap.biggest_drop.quantity > 1 && (
                  <span className="text-osrs-parchment-dark/70 text-sm">
                    {" "}
                    ×{recap.biggest_drop.quantity.toLocaleString()}
                  </span>
                )}
              </div>
              <div className="text-osrs-parchment-dark/70 truncate text-sm">
                {recap.biggest_drop.npc_name ?? "Unknown source"}
                {isGroup && recap.biggest_drop.player_name && ` · ${recap.biggest_drop.player_name}`}
                {/* Only meaningful from web76a onward; older drops have no KC. */}
                {recap.biggest_drop.kill_count !== null &&
                  ` · at ${recap.biggest_drop.kill_count.toLocaleString()} KC`}
              </div>
            </div>
            <div className="text-osrs-gold-bright shrink-0 text-xl font-bold tabular-nums">
              {formatGp(recap.biggest_drop.total_value)}
            </div>
          </div>
        </Section>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {recap.top_items.length > 0 && (
          <Section title="Top items">
            <ul className="space-y-1.5">
              {recap.top_items.slice(0, 5).map((item) => (
                <li key={item.item_id} className="flex items-center gap-2 text-sm">
                  <ItemDbIcon itemId={item.item_id} size={20} />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <span className="text-osrs-gold-bright shrink-0 tabular-nums">
                    {formatGp(item.loot)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Omitted entirely when player_npc_hourly_totals has no coverage for
            the period, rather than rendering an empty or zeroed list. */}
        {npcAvailable && (
          <Section title="Top sources">
            <ul className="space-y-1.5">
              {recap.top_npcs.slice(0, 5).map((npc) => (
                <li key={npc.npc_id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{npc.name}</span>
                  {npc.kills ? (
                    <span className="text-osrs-parchment-dark/60 shrink-0 text-xs">
                      {npc.kills.toLocaleString()} kc
                    </span>
                  ) : null}
                  <span className="text-osrs-gold-bright shrink-0 tabular-nums">
                    {formatGp(npc.loot)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {isGroup && recap.top_members && recap.top_members.length > 0 && (
        <Section title="Top members">
          <ol className="space-y-1.5">
            {recap.top_members.slice(0, 5).map((member, i) => (
              <li key={member.player_id} className="flex items-center gap-2 text-sm">
                <span className="text-osrs-parchment-dark/50 w-5 shrink-0 tabular-nums">
                  {i + 1}.
                </span>
                <span className="min-w-0 flex-1 truncate">{member.name ?? "Unknown"}</span>
                <span className="text-osrs-gold-bright shrink-0 tabular-nums">
                  {formatGp(member.loot)}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {superlatives.length > 0 && (
        <Section title="Standouts">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {superlatives.map(([key, value]) => (
              <div key={key} className="bg-osrs-surface-2/70 rounded-lg px-3 py-2">
                <div className="text-osrs-parchment-dark/60 text-xs">
                  {SUPERLATIVE_LABELS[key] ?? key}
                </div>
                <div className="truncate text-sm font-semibold">{value!.name ?? "Unknown"}</div>
                <div className="text-osrs-parchment-dark/50 text-xs tabular-nums">
                  {value!.count.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {achievements.length > 0 && (
        <Section title="Milestones">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {achievements.map(([key, count]) => (
              <div key={key} className="bg-osrs-surface-2/70 rounded-lg px-3 py-2">
                <div className="text-osrs-gold-bright text-lg font-bold tabular-nums">
                  {count.toLocaleString()}
                </div>
                <div className="text-osrs-parchment-dark/60 text-xs">
                  {ACHIEVEMENT_LABELS[key] ?? key}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {recap.by_month && recap.by_month.length > 1 && (
        <Section title="Month by month">
          <MonthBars months={recap.by_month} peak={recap.peak_month?.period} />
        </Section>
      )}

      <footer className="border-osrs-bronze/30 text-osrs-parchment-dark/50 mt-6 border-t pt-3 text-xs">
        droptracker.io
        {recap.npc_data_available === false && " · source breakdown unavailable for this period"}
      </footer>
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
    <div className="flex items-end gap-1" style={{ height: 96 }}>
      {months.map((m) => (
        <div key={m.period} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div
            className={`w-full rounded-t ${
              m.period === peak ? "bg-osrs-gold-bright" : "bg-osrs-bronze/60"
            }`}
            // Percentage of the tallest bar; floored so an active-but-small
            // month is still visibly present rather than a hairline.
            style={{ height: `${Math.max(4, (m.loot / max) * 80)}px` }}
          />
          <div className="text-osrs-parchment-dark/50 text-[10px]">
            {m.period.slice(5) || m.period}
          </div>
        </div>
      ))}
    </div>
  );
}
