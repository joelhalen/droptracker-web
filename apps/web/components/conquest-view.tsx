"use client";

/**
 * Conquest live view (web120a): the map with the standings, regions and the
 * battle feed around it. Used on the public event page; transport-agnostic
 * (`fetchMap` / `fetchBattles` default to the site's server actions, a host
 * like the Discord Activity can inject its own).
 *
 * Realtime: every troop publishes a frame on the event's SSE scope; frames
 * schedule ONE debounced refetch (bursts coalesce), and a capture makes its
 * tile pulse. Hold-time scores tick on their own, so a live map also refetches
 * once a minute without any frame.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type {
  ConquestBattle,
  ConquestMap,
  ConquestTile,
  RealtimeEvent,
} from "@droptracker/api-types";
import {
  fetchEventConquest,
  fetchEventConquestBattles,
} from "@/app/(site)/(public)/events/[id]/actions";
import { ConquestMapCanvas, canvasFromMap } from "@/components/conquest-map";
import { TaskDetailSheet, useCoarsePointer } from "@/components/task-detail";
import { EmptyState } from "@/components/ui";
import {
  NEUTRAL_COLOR,
  battleText,
  conquestTeamColors,
  diceText,
  fmtPoints,
  holdingText,
  regionBonusText,
  regionStanding,
  regionStatusText,
  settingsSummary,
  tilesToControl,
  type RegionStanding,
} from "@/lib/conquest";
import { TEAM_COLORS } from "@/lib/events";
import { formatRelativeTime } from "@/lib/format";
import { useEventStream } from "@/lib/use-event-stream";

const REFETCH_KINDS = new Set(["conquest", "conquest_progress", "revoke", "recompute"]);
const REFETCH_GAP_MS = 2000;
const TICK_MS = 60_000;
const FLASH_MS = 6000;

type MapFetcher = (eventId: number) => Promise<ConquestMap>;
type BattlesFetcher = (
  eventId: number,
  before: number,
) => Promise<{ battles: ConquestBattle[]; next_before: number | null }>;

export function ConquestView({
  eventId,
  initial,
  live,
  viewerTeamId = null,
  fetchMap = fetchEventConquest,
  fetchBattles = fetchEventConquestBattles,
}: {
  eventId: number;
  initial: ConquestMap;
  live: boolean;
  viewerTeamId?: number | null;
  fetchMap?: MapFetcher;
  fetchBattles?: BattlesFetcher;
}) {
  const [map, setMap] = useState(initial);
  const [older, setOlder] = useState<ConquestBattle[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  /** The region lit on the map: hovered there, or in the regions list. */
  const [litRegion, setLitRegion] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const coarse = useCoarsePointer();

  const refetchNow = useCallback(() => {
    startTransition(async () => {
      try {
        setMap(await fetchMap(eventId));
      } catch {
        /* keep the last good map */
      }
    });
  }, [eventId, fetchMap]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRunAt = useRef(0);
  const scheduleRefetch = useCallback(() => {
    if (timer.current) return;
    const wait = Math.max(0, lastRunAt.current + REFETCH_GAP_MS - Date.now());
    timer.current = setTimeout(() => {
      timer.current = null;
      lastRunAt.current = Date.now();
      refetchNow();
    }, wait);
  }, [refetchNow]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onFrame = useCallback(
    (frame: RealtimeEvent) => {
      if (frame.type !== "event_update") return;
      const data = frame.data as { kind?: string; captured?: boolean; tile_id?: number };
      if (!data.kind || !REFETCH_KINDS.has(data.kind)) return;
      if (data.captured && data.tile_id != null) {
        const key = String(data.tile_id);
        setFlash((prev) => new Set(prev).add(key));
        setTimeout(() => {
          setFlash((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }, FLASH_MS);
      }
      scheduleRefetch();
    },
    [scheduleRefetch],
  );
  useEventStream(live ? [`event:${eventId}`] : [], onFrame);

  // Hold-time points accrue without any frame: refresh the standings.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(refetchNow, TICK_MS);
    return () => clearInterval(id);
  }, [live, refetchNow]);

  const colors = useMemo(() => conquestTeamColors(map.teams, TEAM_COLORS), [map.teams]);
  const names = useMemo(() => new Map(map.teams.map((t) => [t.id, t.name])), [map.teams]);
  const tileById = useMemo(() => new Map(map.tiles.map((t) => [t.id, t])), [map.tiles]);
  const regionById = useMemo(() => new Map(map.regions.map((r) => [r.id, r])), [map.regions]);

  const canvas = canvasFromMap(map);
  const regionStandings = useMemo(() => {
    const out = new Map<number, RegionStanding>();
    for (const r of map.regions) {
      out.set(r.id, regionStanding(map.tiles.filter((t) => t.region_id === r.id)));
    }
    return out;
  }, [map.regions, map.tiles]);

  const standings = [...map.teams].sort(
    (a, b) =>
      b.live_score - a.live_score || b.tiles - a.tiles || b.regions - a.regions || a.id - b.id,
  );
  const battles = [...map.battles, ...older.filter((b) => !map.battles.some((m) => m.id === b.id))];

  const loadOlder = () => {
    const last = battles[battles.length - 1];
    const before = nextBefore ?? last?.id;
    if (!before) return;
    startTransition(async () => {
      try {
        const page = await fetchBattles(eventId, before);
        setOlder((prev) => [...prev, ...page.battles]);
        setNextBefore(page.next_before);
      } catch {
        /* the button stays; try again */
      }
    });
  };

  const renderCard = (key: string) => {
    const tile = tileById.get(Number(key));
    const region = tile?.region_id != null ? regionById.get(tile.region_id) : undefined;
    return tile ? (
      <TileDetail
        tile={tile}
        region={
          region
            ? {
                name: region.name,
                bonus: region.bonus,
                standing: regionStandings.get(region.id)!,
                tiles: map.tiles.filter((t) => t.region_id === region.id),
              }
            : undefined
        }
        names={names}
        colors={colors}
        maxDefense={map.settings.max_defense}
        scoringMode={map.settings.scoring_mode}
        rulesHidden={map.rules_hidden}
        viewerTeamId={viewerTeamId}
      />
    ) : null;
  };

  if (!map.tiles.length) {
    return (
      <EmptyState
        title="The map isn't drawn yet"
        hint="The organisers are still building this Conquest map."
      />
    );
  }

  const sheetTile = sheetKey != null ? tileById.get(Number(sheetKey)) : undefined;

  return (
    <div className="space-y-6">
      <p className="text-osrs-parchment-dark/70 text-sm">{settingsSummary(map.settings)}</p>
      {!map.seeded && (
        <p className="text-osrs-parchment-dark/60 text-xs">
          {map.settings.start_mode === "dealt"
            ? "The tiles are dealt out between the teams when the event starts."
            : "Every tile starts unowned. The first troop on a tile claims it."}
        </p>
      )}

      <ConquestMapCanvas
        tiles={canvas.tiles}
        regions={canvas.regions}
        edges={canvas.edges}
        background={canvas.background}
        space={canvas.space}
        highlightRegionKey={litRegion}
        onHoverRegion={setLitRegion}
        colors={colors}
        maxDefense={map.settings.max_defense}
        viewerTeamId={viewerTeamId}
        flashKeys={flash}
        coarse={coarse}
        renderCard={renderCard}
        onSelect={(key) => {
          if (coarse) setSheetKey(key);
        }}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h3 className="text-osrs-gold mb-2 text-base font-semibold">Standings</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-osrs-parchment-dark/60 text-left text-xs">
                  <th className="py-1 pr-2 font-medium">#</th>
                  <th className="py-1 pr-2 font-medium">Team</th>
                  <th className="py-1 pr-2 text-right font-medium">Points</th>
                  <th className="py-1 pr-2 text-right font-medium">Tiles</th>
                  <th className="py-1 pr-2 text-right font-medium">Regions</th>
                  <th className="py-1 text-right font-medium">
                    {map.settings.scoring_mode === "hold_time" ? "Earning" : "Holding"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {standings.map((team, i) => (
                  <tr
                    key={team.id}
                    className={`border-osrs-bronze/15 border-t ${
                      team.id === viewerTeamId ? "bg-osrs-gold/10" : ""
                    }`}
                  >
                    <td className="py-1.5 pr-2 tabular-nums">{i + 1}</td>
                    <td className="py-1.5 pr-2">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block size-3 shrink-0 rounded-full"
                          style={{ background: colors.get(team.id) ?? NEUTRAL_COLOR }}
                        />
                        <span className="text-osrs-parchment truncate">{team.name}</span>
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 text-right font-semibold tabular-nums">
                      {fmtPoints(team.live_score)}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{team.tiles}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{team.regions}</td>
                    <td className="text-osrs-parchment-dark/70 py-1.5 text-right text-xs tabular-nums">
                      {holdingText(team, map.settings.scoring_mode)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-osrs-gold mb-1 mt-6 text-base font-semibold">Regions</h3>
          <p className="text-osrs-parchment-dark/60 mb-2 text-xs">
            Hold every tile in a region to control it and earn its bonus. Point at a region to find
            it on the map.
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {map.regions.map((r) => {
              const standing = regionStandings.get(r.id)!;
              const members = map.tiles.filter((t) => t.region_id === r.id && t.kind !== "respawn");
              const lit = litRegion === String(r.id);
              return (
                <li
                  key={r.id}
                  onPointerEnter={() => setLitRegion(String(r.id))}
                  onPointerLeave={() => setLitRegion(null)}
                  className={`rounded border px-2.5 py-2 text-sm transition-colors ${
                    lit ? "border-osrs-gold/70 bg-osrs-gold/10" : "border-osrs-bronze/20"
                  }`}
                  style={{ borderLeft: `4px solid ${r.color ?? NEUTRAL_COLOR}` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-osrs-parchment flex min-w-0 items-center gap-1.5 truncate font-medium">
                      {standing.controller != null && (
                        <Crown color={colors.get(standing.controller) ?? NEUTRAL_COLOR} />
                      )}
                      {r.name}
                    </span>
                    <span className="text-osrs-gold/80 shrink-0 text-xs">
                      +{fmtPoints(r.bonus)}
                      {map.settings.scoring_mode === "hold_time" ? "/h" : ""}
                    </span>
                  </div>
                  <OwnershipBar tiles={members} colors={colors} />
                  <p className="text-osrs-parchment-dark/70 mt-1 text-xs">
                    {regionStatusText(standing, names)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h3 className="text-osrs-gold mb-2 text-base font-semibold">Battle log</h3>
          {battles.length ? (
            <ul className="space-y-1.5">
              {battles.map((b) => {
                const tile = tileById.get(b.tile_id);
                const dice = diceText(b);
                return (
                  <li
                    key={b.id}
                    className="border-osrs-bronze/15 flex items-start gap-2 border-b pb-1.5 text-sm"
                  >
                    <span
                      className="mt-1.5 inline-block size-2.5 shrink-0 rounded-full"
                      style={{
                        background:
                          b.team_id != null
                            ? (colors.get(b.team_id) ?? NEUTRAL_COLOR)
                            : NEUTRAL_COLOR,
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-osrs-parchment">
                        {battleText(b, names, tile?.label ?? "a tile")}
                      </span>
                      <span className="text-osrs-parchment-dark/60 block text-xs">
                        {b.player_name ? `${b.player_name} · ` : ""}
                        {dice ? `\u{1F3B2} ${dice} · ` : ""}
                        {formatRelativeTime(b.at)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-osrs-parchment-dark/60 text-sm">
              {map.seeded ? "No battles yet." : "Battles start when the event does."}
            </p>
          )}
          {battles.length >= 20 && (nextBefore !== null || older.length === 0) && (
            <button
              type="button"
              onClick={loadOlder}
              className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright mt-2 text-xs"
            >
              Show older battles
            </button>
          )}
        </section>
      </div>

      <details className="border-osrs-bronze/25 rounded border px-3 py-2 text-sm">
        <summary className="text-osrs-gold cursor-pointer font-semibold">
          How Conquest works
        </summary>
        <ul className="text-osrs-parchment-dark/80 mt-2 list-disc space-y-1 pl-5">
          <li>
            Every tile is a boss or activity. Doing what it asks earns your team troops there.
          </li>
          <li>
            A troop on an empty tile claims it. A troop on your own tile adds a point of defense.
          </li>
          <li>
            {map.settings.battle_mode === "dice"
              ? `A troop on a rival's tile attacks: you roll ${map.settings.attack_dice} dice, they roll one per defense point (up to ${map.settings.defense_dice}), highest dice compared in pairs, ties go to the defender.`
              : "A troop on a rival's tile knocks off one point of defense."}
          </li>
          <li>
            A tile with no defense left falls to the next enemy troop. Reinforce before it does.
          </li>
          <li>Hold every tile in a region for its bonus.</li>
          <li>
            {map.settings.scoring_mode === "hold_time"
              ? "Tiles and regions pay points for every hour you hold them."
              : "Only the map at the end counts."}
          </li>
        </ul>
      </details>

      {coarse && (
        <TaskDetailSheet open={sheetTile != null} onClose={() => setSheetKey(null)}>
          {sheetTile ? renderCard(String(sheetTile.id)) : null}
        </TaskDetailSheet>
      )}
    </div>
  );
}

/** One segment per tile in the region, in its holder's colour. */
function OwnershipBar({
  tiles,
  colors,
}: {
  tiles: Pick<ConquestTile, "id" | "label" | "owner_team_id">[];
  colors: Map<number, string>;
}) {
  if (!tiles.length) return null;
  const sorted = [...tiles].sort(
    (a, b) => (a.owner_team_id ?? Infinity) - (b.owner_team_id ?? Infinity) || a.id - b.id,
  );
  return (
    <div className="mt-1.5 flex h-2 gap-[2px]" aria-hidden="true">
      {sorted.map((t) => (
        <span
          key={t.id}
          title={t.label}
          className="flex-1 rounded-sm"
          style={{
            background:
              t.owner_team_id != null
                ? (colors.get(t.owner_team_id) ?? NEUTRAL_COLOR)
                : "rgba(243,230,196,0.18)",
          }}
        />
      ))}
    </div>
  );
}

/** A drawn crown (no emoji anywhere Conquest is shown). */
function Crown({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 28 18" className="h-3 w-4 shrink-0" aria-label="Controlled">
      <path
        d="M0 18 L2 4 L8 11 L14 0 L20 11 L26 4 L28 18 Z"
        fill={color}
        stroke="rgba(0,0,0,0.8)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TileDetail({
  tile,
  region,
  names,
  colors,
  maxDefense,
  scoringMode,
  rulesHidden,
  viewerTeamId,
}: {
  tile: ConquestTile;
  region?: {
    name: string;
    bonus: number;
    standing: RegionStanding;
    tiles: ConquestTile[];
  };
  names: Map<number, string>;
  colors: Map<number, string>;
  maxDefense: number;
  scoringMode: "hold_time" | "final";
  rulesHidden: boolean;
  viewerTeamId: number | null;
}) {
  if (tile.kind === "respawn") {
    return (
      <div className="text-sm">
        <p className="text-osrs-gold font-semibold">{tile.label}</p>
        <p className="text-osrs-parchment-dark/70 mt-1 text-xs">
          A respawn point. Nobody can own it.
        </p>
      </div>
    );
  }
  const owner = tile.owner_team_id;
  return (
    <div className="space-y-2 text-sm">
      <div>
        <p className="text-osrs-gold font-semibold">{tile.label}</p>
        {region && <p className="text-osrs-parchment-dark/60 text-xs">In {region.name}</p>}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{
              background: owner != null ? (colors.get(owner) ?? NEUTRAL_COLOR) : NEUTRAL_COLOR,
            }}
          />
          <span className="text-osrs-parchment">
            {owner != null ? (names.get(owner) ?? "A team") : "Unowned"}
          </span>
          {owner != null && tile.owner_since && (
            <span className="text-osrs-parchment-dark/60">
              since {formatRelativeTime(tile.owner_since)}
            </span>
          )}
        </span>
        <span className="text-osrs-parchment-dark/80">
          Defense {tile.defense}/{maxDefense}
        </span>
      </div>
      <p className="text-osrs-parchment-dark/70 text-xs">
        Worth {fmtPoints(tile.value)} {tile.value === 1 ? "point" : "points"}{" "}
        {scoringMode === "hold_time" ? "per hour held" : "at the end"}
        {tile.captures ? ` · taken ${tile.captures} time${tile.captures === 1 ? "" : "s"}` : ""}
      </p>
      {region && (
        <RegionBlock
          region={region}
          names={names}
          colors={colors}
          scoringMode={scoringMode}
          viewerTeamId={viewerTeamId}
        />
      )}
      {rulesHidden ? (
        <p className="text-osrs-parchment-dark/60 text-xs">
          The organisers keep the tile rules hidden.
        </p>
      ) : (
        <div className="border-osrs-bronze/25 space-y-2 border-t pt-2">
          <p className="text-osrs-parchment-dark/60 text-[11px] font-semibold uppercase tracking-wide">
            Earn troops here
          </p>
          {tile.rules.map((rule) => {
            const rows = Object.entries(rule.progress)
              .map(([teamId, have]) => ({ teamId: Number(teamId), have }))
              .sort(
                (a, b) =>
                  (b.teamId === viewerTeamId ? 1 : 0) - (a.teamId === viewerTeamId ? 1 : 0) ||
                  b.have - a.have,
              )
              .slice(0, 4);
            return (
              <div key={rule.id} className="space-y-1">
                <p className="text-osrs-parchment text-xs">
                  {rule.label}{" "}
                  <span className="text-osrs-gold/90">
                    = {rule.troops} troop{rule.troops === 1 ? "" : "s"}
                  </span>
                </p>
                {rows.map((row) => (
                  <div key={row.teamId} className="flex items-center gap-2 text-[11px]">
                    <span className="text-osrs-parchment-dark/70 w-20 truncate">
                      {names.get(row.teamId) ?? "Team"}
                    </span>
                    <span className="bg-osrs-brown-dark/60 h-1.5 flex-1 overflow-hidden rounded">
                      <span
                        className="block h-full"
                        style={{
                          width: `${Math.min(100, (row.have / Math.max(rule.target, 1)) * 100)}%`,
                          background: colors.get(row.teamId) ?? NEUTRAL_COLOR,
                        }}
                      />
                    </span>
                    <span className="text-osrs-parchment-dark/70 tabular-nums">
                      {row.have}/{rule.target}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** The tile's region in Risk terms: who holds what, who is closest to
 * control, and what the viewer's team still has to take. */
function RegionBlock({
  region,
  names,
  colors,
  scoringMode,
  viewerTeamId,
}: {
  region: { name: string; bonus: number; standing: RegionStanding; tiles: ConquestTile[] };
  names: Map<number, string>;
  colors: Map<number, string>;
  scoringMode: "hold_time" | "final";
  viewerTeamId: number | null;
}) {
  const { standing } = region;
  const counted = region.tiles.filter((t) => t.kind !== "respawn");
  const missing =
    viewerTeamId != null && standing.controller !== viewerTeamId
      ? tilesToControl(region.tiles, viewerTeamId)
      : [];
  return (
    <div className="border-osrs-bronze/25 space-y-1.5 border-t pt-2">
      <p className="text-osrs-parchment-dark/60 text-[11px] font-semibold uppercase tracking-wide">
        {region.name}
      </p>
      <OwnershipBar tiles={counted} colors={colors} />
      <p className="text-osrs-parchment text-xs">{regionStatusText(standing, names)}</p>
      {standing.counts.length > 1 && (
        <p className="text-osrs-parchment-dark/70 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px]">
          {standing.counts.map((c) => (
            <span key={c.teamId} className="flex items-center gap-1">
              <span
                className="inline-block size-2 rounded-full"
                style={{ background: colors.get(c.teamId) ?? NEUTRAL_COLOR }}
              />
              {names.get(c.teamId) ?? "Team"} {c.tiles}
            </span>
          ))}
          {standing.unowned > 0 && <span>Unowned {standing.unowned}</span>}
        </p>
      )}
      {missing.length > 0 && missing.length < counted.length && (
        <p className="text-osrs-gold/90 text-[11px]">
          Your team needs {missing.length} more: {missing.map((t) => t.label).join(", ")}.
        </p>
      )}
      <p className="text-osrs-parchment-dark/60 text-[11px]">
        {regionBonusText(region.bonus, scoringMode, standing.total)}
      </p>
    </div>
  );
}
