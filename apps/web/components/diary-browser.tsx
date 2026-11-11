"use client";

/**
 * Achievement diaries as the in-game journal shows them: the list of areas
 * coloured by progress (green done, yellow started, red untouched), and the
 * chosen area's tasks by tier with completed ones struck through.
 *
 * The plugin syncs a count per tier, so the tier headers are always exact.
 * Which individual tasks are done is known for a finished or untouched tier,
 * and otherwise comes from the wiki's WikiSync data when it agrees with that
 * count; a task nobody can vouch for is shown plainly rather than guessed.
 * The journal is fetched when this mounts (it is every task of every diary),
 * with the synced counts on screen in the meantime.
 */
import { useEffect, useState } from "react";
import { PlayerDiariesSchema, type DiaryArea, type PlayerDiaries } from "@droptracker/api-types";
import { DIARY_AREA_ITEM, SITE_IMG_BASE, progressTone } from "@/lib/player-progress";

const TIERS = ["Easy", "Medium", "Hard", "Elite"];

type AreaSummary = {
  area_id: number;
  name: string;
  tiers: { tier: number; name: string; completed: number | null; total: number | null }[];
};

function summarise(areas: DiaryArea[]): AreaSummary[] {
  return areas.map((area) => ({
    area_id: area.area_id,
    name: area.name,
    tiers: [0, 1, 2, 3].map((tier) => {
      const row = area.tiers.find((t) => t.tier === tier);
      return {
        tier,
        name: TIERS[tier] ?? String(tier),
        completed: row?.completed ?? null,
        total: row?.total ?? null,
      };
    }),
  }));
}

function areaTone(area: AreaSummary): string {
  const done = area.tiers.reduce((n, t) => n + (t.completed ?? 0), 0);
  const total = area.tiers.reduce((n, t) => n + (t.total ?? 0), 0);
  return progressTone(done, total || null);
}

/** Four pips, one per tier: filled when the tier is complete. */
function TierPips({ area }: { area: AreaSummary }) {
  return (
    <span className="flex shrink-0 gap-0.5" aria-hidden>
      {area.tiers.map((t) => {
        const complete = t.total != null && t.completed != null && t.completed >= t.total;
        const started = (t.completed ?? 0) > 0;
        return (
          <span
            key={t.tier}
            title={`${t.name}: ${t.completed ?? 0}${t.total != null ? `/${t.total}` : ""}`}
            className={`size-2 rounded-[2px] ${
              complete ? "bg-osrs-green" : started ? "bg-osrs-gold-bright/80" : "bg-osrs-red/50"
            }`}
          />
        );
      })}
    </span>
  );
}

export function DiaryBrowser({
  playerId,
  diaries,
  imgBase = SITE_IMG_BASE,
}: {
  playerId: number;
  /** The synced counts from the achievements payload. */
  diaries: DiaryArea[];
  imgBase?: string;
}) {
  const [journal, setJournal] = useState<PlayerDiaries | null>(null);
  const [failed, setFailed] = useState(false);
  const [areaId, setAreaId] = useState<number>(diaries[0]?.area_id ?? 0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/players/${playerId}/diaries`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body) => {
        const parsed = PlayerDiariesSchema.safeParse(body);
        if (cancelled) return;
        if (parsed.success) setJournal(parsed.data);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const areas: AreaSummary[] = journal
    ? journal.areas.map((a) => ({
        area_id: a.area_id,
        name: a.name,
        tiers: a.tiers.map((t) => ({ tier: t.tier, name: t.name, completed: t.completed, total: t.total })),
      }))
    : summarise(diaries);
  const selected = areas.find((a) => a.area_id === areaId) ?? areas[0];
  const selectedJournal = journal?.areas.find((a) => a.area_id === selected?.area_id);

  const done = areas.reduce((n, a) => n + a.tiers.reduce((m, t) => m + (t.completed ?? 0), 0), 0);
  const total = areas.reduce((n, a) => n + a.tiers.reduce((m, t) => m + (t.total ?? 0), 0), 0);
  const tiersDone = areas.reduce(
    (n, a) => n + a.tiers.filter((t) => t.total != null && (t.completed ?? 0) >= t.total).length,
    0,
  );

  if (!selected) return null;

  return (
    <div>
      {total > 0 && (
        <div className="border-osrs-bronze/30 border-b p-2.5">
          <div className="border-osrs-bronze/50 bg-osrs-surface-3 relative h-7 overflow-hidden rounded border">
            <div
              className="bg-osrs-green/70 absolute inset-y-0 left-0"
              style={{ width: `${Math.min(100, (done / total) * 100)}%` }}
            />
            <div className="font-osrs text-osrs-parchment absolute inset-0 flex items-center justify-center gap-1.5 px-2 text-sm [text-shadow:1px_1px_0_#000]">
              <img src="/osrs/diary.png" alt="" className="size-4 [image-rendering:pixelated]" />
              <span className="truncate">
                Tasks completed: {done}/{total} · {tiersDone}/{areas.length * 4} diaries
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-[minmax(11rem,15rem)_minmax(0,1fr)]">
        <div className="border-osrs-bronze/25 max-h-[30rem] overflow-y-auto border-b md:border-r md:border-b-0">
          {areas.map((area) => {
            const item = DIARY_AREA_ITEM[area.area_id];
            return (
              <button
                key={area.area_id}
                type="button"
                onClick={() => setAreaId(area.area_id)}
                aria-current={selected.area_id === area.area_id}
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors ${
                  selected.area_id === area.area_id ? "bg-osrs-bronze/30" : "hover:bg-osrs-bronze/15"
                }`}
              >
                <span className="flex size-6 shrink-0 items-center justify-center">
                  {item && (
                    <img
                      src={`${imgBase}/itemdb/${item}.png`}
                      alt=""
                      loading="lazy"
                      className="max-h-6 max-w-6 object-contain [image-rendering:pixelated]"
                    />
                  )}
                </span>
                <span className={`font-osrs min-w-0 flex-1 truncate text-sm ${areaTone(area)}`}>{area.name}</span>
                <TierPips area={area} />
              </button>
            );
          })}
        </div>

        <div className="max-h-[30rem] overflow-y-auto p-3">
          <h3 className={`font-osrs mb-2 text-lg leading-tight ${areaTone(selected)}`}>
            {selected.name} Diary
          </h3>

          {selected.tiers.map((tier) => {
            const tierJournal = selectedJournal?.tiers.find((t) => t.tier === tier.tier);
            const tone = progressTone(tier.completed, tier.total);
            return (
              <section key={tier.tier} className="mb-3 last:mb-0">
                <div className="border-osrs-bronze/30 mb-1 flex items-baseline justify-between gap-2 border-b pb-0.5">
                  <h4 className={`font-osrs text-base ${tone}`}>{tier.name}</h4>
                  <span className={`font-osrs text-sm tabular-nums ${tone}`}>
                    {tier.completed ?? "—"}
                    {tier.total != null ? `/${tier.total}` : ""}
                    {tier.total != null && (tier.completed ?? 0) >= tier.total ? " ✔" : ""}
                  </span>
                </div>
                {tierJournal ? (
                  <>
                    <ul className="space-y-0.5">
                      {tierJournal.tasks.map((task, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm leading-snug">
                          <span
                            aria-hidden
                            className={`mt-px w-3.5 shrink-0 text-center text-xs ${
                              task.completed === true
                                ? "text-osrs-green"
                                : task.completed === false
                                  ? "text-osrs-red/80"
                                  : "text-osrs-parchment-dark/40"
                            }`}
                          >
                            {task.completed === true ? "✔" : task.completed === false ? "✘" : "•"}
                          </span>
                          <span className="min-w-0">
                            <span
                              className={
                                task.completed === true
                                  ? "text-osrs-green/90 decoration-osrs-green/50 line-through"
                                  : task.completed === false
                                    ? "text-osrs-parchment"
                                    : "text-osrs-parchment/80"
                              }
                            >
                              <span className="sr-only">
                                {task.completed === true
                                  ? "Done: "
                                  : task.completed === false
                                    ? "Not done: "
                                    : ""}
                              </span>
                              {task.description}
                            </span>
                            {task.completed !== true && task.requirements.length > 0 && (
                              <span className="text-osrs-parchment-dark/55 block text-xs">
                                {task.requirements.join(" · ")}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {!tierJournal.tasks_known && tierJournal.completed != null && (
                      <p className="text-osrs-parchment-dark/50 mt-1 text-xs">
                        {tierJournal.completed} of these {tierJournal.total} are done. The game reports the
                        count, not which ones.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-osrs-parchment-dark/50 text-xs">
                    {failed ? "The task list could not be loaded." : "Loading tasks…"}
                  </p>
                )}
              </section>
            );
          })}

          {journal?.wikisync_used && (
            <p className="text-osrs-parchment-dark/45 mt-3 text-[11px]">
              Individual tasks in part-finished diaries come from this player&apos;s WikiSync data, used only
              where it matches the count the DropTracker plugin synced.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
