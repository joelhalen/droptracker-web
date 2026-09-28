"use client";

/**
 * Conquest map designer (web120a) — the event manager's "Map" tab.
 *
 * The fast path is a preset: one click builds the Gielinor map with every
 * tile's troop rules sized from kill rates. The organiser picks which regions
 * and tiles it holds (ConquestPresetPicker), and the troop cost suggestion
 * follows the pick; anything short of the whole map is redrawn for that pick
 * on the server (~20 s, the button waits). From there
 * (or from scratch) the organiser can drag tiles, rename them, move them
 * between regions, tune each rule's troops, attach any event task to a tile,
 * set per-tile defense caps, garrisons and team homes, choose which tiles
 * border each other (connect mode; the fronts rule reads them), and restyle
 * the regions. Save sends the whole map (a PUT guarded by the map's revision,
 * so two open editors can't overwrite each other).
 *
 * The map locks when the event starts; the settings (below the designer) and
 * the live tile corrections stay available.
 */
import { useEffect, useMemo, useState, useTransition } from "react";
import type {
  ConquestMap,
  ConquestPresetOptions,
  EventDetail,
  EventTask,
} from "@droptracker/api-types";
import {
  applyConquestPreset,
  clearConquestBackground,
  fetchConquestMap,
  fetchConquestPresets,
  saveConquestMap,
  uploadConquestBackground,
} from "@/app/(site)/(admin)/groups/[id]/events/conquest-actions";
import { reloadGroupEvent } from "@/app/(site)/(admin)/groups/[id]/events/actions";
import {
  ConquestMapCanvas,
  canvasFromMap,
  type CanvasRegion,
  type CanvasTile,
} from "@/components/conquest-map";
import { ConquestPresetPicker } from "@/components/conquest-preset-picker";
import { ConquestLiveTools, ConquestSettingsForm } from "@/components/conquest-settings";
import { Alert, Button } from "@/components/ui";
import {
  MAX_RULES_PER_TILE,
  MAX_TROOPS_PER_RULE,
  REGION_COLORS,
  autoConnect,
  clamp01,
  conquestTeamColors,
  draftFromMap,
  draftParts,
  draftProblems,
  draftToInput,
  isolatedTiles,
  liveEdges,
  newKey,
  toggleEdge,
  presetAvailableTiles,
  presetSelectionBody,
  presetSuggestedHours,
  planHotZones,
  ruleEligible,
  type ConquestDraft,
  type DraftHotZone,
  type DraftTile,
} from "@/lib/conquest";
import { TEAM_COLORS } from "@/lib/events";

const input =
  "border-osrs-bronze/40 bg-osrs-brown-dark/60 text-osrs-parchment focus:border-osrs-gold/70 rounded border px-2 py-1 text-sm outline-none";

export function ConquestDesigner({
  groupId,
  event,
  tasks,
  onDetail,
}: {
  groupId: number | null;
  event: EventDetail;
  tasks: EventTask[];
  /** Refresh the manager after a change that created or removed tasks. */
  onDetail?: (detail: EventDetail) => void;
}) {
  const [map, setMap] = useState<ConquestMap | null>(null);
  const [draft, setDraft] = useState<ConquestDraft>({
    regions: [],
    tiles: [],
    edges: [],
    hotzones: [],
  });
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  // Connect mode: click a tile, then the tiles it borders.
  const [connecting, setConnecting] = useState(false);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [presets, setPresets] = useState<ConquestPresetOptions | null>(null);
  // The preset picker: tiles to build, and a troop cost the organiser chose
  // (null = follow the suggestion for the current pick).
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [troopHours, setTroopHours] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editable = event.status === "draft";

  const adopt = (next: ConquestMap) => {
    setMap(next);
    setDraft(draftFromMap(next));
    setDirty(false);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchConquestMap(groupId, event.id);
      if (cancelled) return;
      if (res.ok) adopt(res.data);
      else setError(res.message);
      if (editable) {
        const opts = await fetchConquestPresets(groupId, event.id);
        if (!cancelled && opts.ok) {
          setPresets(opts.data);
          setPicked(presetAvailableTiles(opts.data.regions));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Load once per event; `editable` only gates the preset read.
  }, [groupId, event.id, editable]);

  const refreshManager = async () => {
    if (!onDetail) return;
    try {
      onDetail(await reloadGroupEvent(groupId, event.id));
    } catch {
      /* the manager keeps its current state */
    }
  };

  const patchDraft = (fn: (d: ConquestDraft) => ConquestDraft) => {
    setDraft((d) => fn(d));
    setDirty(true);
    setNotice(null);
  };
  const patchTile = (key: string, fn: (t: DraftTile) => DraftTile) =>
    patchDraft((d) => ({ ...d, tiles: d.tiles.map((t) => (t.key === key ? fn(t) : t)) }));

  const problems = useMemo(() => draftProblems(draft), [draft]);
  const lonely = useMemo(() => isolatedTiles(draft), [draft]);
  const parts = useMemo(() => draftParts(draft), [draft]);
  const usedTaskIds = useMemo(
    () => new Set(draft.tiles.flatMap((t) => t.rules.map((r) => r.task_id))),
    [draft.tiles],
  );
  const eligibleTasks = useMemo(
    () => tasks.filter((t) => ruleEligible(t) && !usedTaskIds.has(t.id)),
    [tasks, usedTaskIds],
  );

  if (!map) {
    return error ? (
      <Alert>{error}</Alert>
    ) : (
      <p className="text-osrs-parchment-dark/60 text-sm">Loading the map…</p>
    );
  }

  const colors = conquestTeamColors(event.teams, TEAM_COLORS);
  const fromMap = canvasFromMap(map, { tile: "t", region: "r" });
  const canvasTiles: CanvasTile[] = editable
    ? draft.tiles.map((t) => ({
        key: t.key,
        label: t.label || "New tile",
        x: t.x,
        y: t.y,
        kind: t.kind,
        icon_npc_id: t.icon_npc_id,
        icon_item_id: t.icon_item_id,
        owner_team_id: null,
        defense: 0,
        region_key: t.region_key,
        shape: t.shape,
      }))
    : fromMap.tiles;
  const canvasRegions: CanvasRegion[] = editable
    ? draft.regions.map((r) => ({ ...r, owner_team_id: null }))
    : fromMap.regions;
  const selectedTile = draft.tiles.find((t) => t.key === selected) ?? null;

  const suggestedHours = presets ? presetSuggestedHours(presets, picked.size) : null;
  // Older servers send no regions: build the whole preset as before.
  const selection = presets?.regions.length ? presetSelectionBody(presets.regions, picked) : {};

  const onBuildPreset = (form: FormData) => {
    const troopHours = Number(form.get("troop_hours"));
    const uniqueTroops = Number(form.get("unique_troops"));
    const phases = Number(form.get("phases") || 1);
    if (presets?.regions.length && !picked.size) {
      setError("Pick at least one tile to build.");
      return;
    }
    if (
      draft.tiles.length &&
      !window.confirm("This replaces the current map, including the tasks its tiles use. Continue?")
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const body = {
        preset: String(form.get("preset") || "gielinor"),
        troop_hours: troopHours,
        unique_troops: uniqueTroops,
        phases,
        ...selection,
      };
      // A smaller pick is drawn fresh on the server: ask again until it's ready.
      let res = await applyConquestPreset(groupId, event.id, body);
      for (let tries = 0; res.ok && !("tiles" in res.data) && tries < 100; tries++) {
        setNotice(res.data.message ?? "Drawing your map…");
        await new Promise((r) => setTimeout(r, 3000));
        res = await applyConquestPreset(groupId, event.id, body);
      }
      if (!res.ok) {
        setNotice(null);
        setError(res.message);
        return;
      }
      if (!("tiles" in res.data)) {
        setNotice(null);
        setError("The map is taking too long to draw. Try again in a minute.");
        return;
      }
      adopt(res.data);
      setSelected(null);
      const summary = res.data.preset_summary;
      setNotice(
        summary
          ? `Built ${summary.tiles} tiles in ${summary.regions} regions.` +
              (summary.skipped.length
                ? ` Left out ${summary.skipped.length} tile${summary.skipped.length === 1 ? "" : "s"} this server can't build yet.`
                : "")
          : "Map built.",
      );
      await refreshManager();
    });
  };

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveConquestMap(groupId, event.id, draftToInput(draft, map.revision));
      if (!res.ok) {
        setError(res.message);
        return;
      }
      adopt(res.data);
      setNotice("Map saved.");
      await refreshManager();
    });
  };

  const addTile = () => {
    const key = newKey(
      "t",
      draft.tiles.map((t) => t.key),
    );
    patchDraft((d) => ({
      ...d,
      tiles: [
        ...d.tiles,
        {
          key,
          label: "New tile",
          x: 0.5,
          y: 0.5,
          kind: "normal",
          value: 1,
          region_key: d.regions[0]?.key ?? null,
          icon_npc_id: null,
          icon_item_id: null,
          shape: null,
          max_defense: null,
          garrison: null,
          home_team_id: null,
          rules: [],
        },
      ],
    }));
    setSelected(key);
  };

  const onTileClick = (key: string) => {
    if (!connecting) {
      setSelected(key);
      return;
    }
    if (!connectFrom || connectFrom === key) {
      setConnectFrom(connectFrom === key ? null : key);
      return;
    }
    patchDraft((d) => toggleEdge(d, connectFrom, key));
  };

  const addRegion = () => {
    const key = newKey(
      "r",
      draft.regions.map((r) => r.key),
    );
    patchDraft((d) => ({
      ...d,
      regions: [
        ...d.regions,
        {
          key,
          name: `Region ${d.regions.length + 1}`,
          color: REGION_COLORS[d.regions.length % REGION_COLORS.length]!,
          bonus: 1,
          label_x: null,
          label_y: null,
          shape: null,
          contested: false,
        },
      ],
    }));
  };

  const onUpload = (file: File) => {
    const form = new FormData();
    form.set("file", file);
    setError(null);
    startTransition(async () => {
      const res = await uploadConquestBackground(groupId, event.id, form);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setMap((m) => (m ? { ...m, ...res.data } : m));
    });
  };

  const onClearBackground = () => {
    startTransition(async () => {
      const res = await clearConquestBackground(groupId, event.id);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setMap((m) => (m ? { ...m, background_url: null, bg_width: null, bg_height: null } : m));
    });
  };

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {!editable && (
        <p className="text-osrs-parchment-dark/70 text-sm">
          The map is locked now the event has started. Settings can still change, and you can
          correct a tile below.
        </p>
      )}

      {editable && presets && (
        <form
          action={onBuildPreset}
          className="border-osrs-gold/30 bg-osrs-brown-dark/30 space-y-3 rounded-lg border p-4"
        >
          <div>
            <h4 className="text-osrs-gold text-base font-semibold">Start from a ready-made map</h4>
            <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
              Every boss gets its own tile in the part of Gielinor it lives in. Each tile pays a
              troop for a set number of kills, sized so a troop takes about the same time at every
              boss, plus bonus troops for any unique. Karamja adds TzHaar and Slayer, and The Seas
              has a tile for every Sailing collection log page. Pick what your clan will play.
            </p>
          </div>
          {presets.regions.length > 0 && (
            <ConquestPresetPicker regions={presets.regions} picked={picked} onChange={setPicked} />
          )}
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="space-y-1">
              <span className="text-osrs-parchment-dark/70 block text-xs">Map</span>
              <select name="preset" className={input} defaultValue={presets.presets[0]?.key}>
                {presets.presets.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-osrs-parchment-dark/70 block text-xs">
                One troop costs (efficient play)
              </span>
              <select
                name="troop_hours"
                className={input}
                value={troopHours ?? suggestedHours ?? presets.suggested_troop_hours}
                onChange={(e) => setTroopHours(Number(e.target.value))}
              >
                {presets.troop_hours_choices.map((h) => (
                  <option key={h} value={h}>
                    {h < 1 ? `${Math.round(h * 60)} minutes` : `${h} hour${h === 1 ? "" : "s"}`}
                    {h === suggestedHours ? " (suggested)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-osrs-parchment-dark/70 block text-xs">Troops for a unique</span>
              <select
                name="unique_troops"
                className={input}
                defaultValue={presets.default_unique_troops}
              >
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "None" : n}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-osrs-parchment-dark/70 block text-xs">Phases</span>
              <select name="phases" className={input} defaultValue={map.settings.phase_count}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "One phase" : `${n} phases`}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="submit"
              size="sm"
              disabled={pending || (presets.regions.length > 0 && picked.size === 0)}
            >
              {pending ? "Building…" : draft.tiles.length ? "Rebuild the map" : "Build the map"}
            </Button>
          </div>
          <p className="text-osrs-parchment-dark/50 text-xs">
            The suggestion aims for about 20 troops per tile over the event, from its teams, roster
            sizes and length, so fewer tiles want a higher cost. Bigger events want a higher cost.
          </p>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {editable && (
          <>
            <Button size="sm" variant="ghost" onClick={addTile} type="button">
              Add tile
            </Button>
            <Button size="sm" variant="ghost" onClick={addRegion} type="button">
              Add region
            </Button>
            <label className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright cursor-pointer text-sm">
              Upload map art
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
            {map.background_url && (
              <button
                type="button"
                onClick={onClearBackground}
                className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-sm"
              >
                Use the drawn map
              </button>
            )}
            <Button
              size="sm"
              variant={connecting ? "primary" : "ghost"}
              type="button"
              onClick={() => {
                setConnecting((c) => !c);
                setConnectFrom(null);
                setSelected(null);
              }}
            >
              {connecting ? "Done connecting" : "Connect tiles"}
            </Button>
            {connecting && (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => patchDraft((d) => autoConnect(d))}
              >
                Connect nearby tiles
              </Button>
            )}
          </>
        )}
        <span className="text-osrs-parchment-dark/60 ml-auto text-xs">
          {draft.tiles.length} tiles · {draft.regions.length} regions · {liveEdges(draft).length}{" "}
          connections
          {editable && !connecting ? " · drag a tile to move it, click it to edit" : ""}
        </span>
      </div>

      {editable && connecting && (
        <p className="text-osrs-parchment-dark/70 text-sm">
          {connectFrom
            ? `Click the tiles that border ${
                draft.tiles.find((t) => t.key === connectFrom)?.label ?? "this tile"
              } to connect them (click again to disconnect). Click it again to pick another tile.`
            : "Click a tile, then every tile it borders. Teams can only attack tiles connected to one they own."}
        </p>
      )}
      {editable && draft.tiles.length > 1 && (lonely.length > 0 || parts > 1) && (
        <p className="text-osrs-gold-bright text-xs">
          {lonely.length > 0
            ? `Not connected to anything: ${lonely
                .slice(0, 4)
                .map((t) => t.label)
                .join(", ")}${lonely.length > 4 ? ` and ${lonely.length - 4} more` : ""}. `
            : ""}
          {parts > 1 ? `The map is in ${parts} separate parts. ` : ""}
          With attacks limited to neighbouring tiles, the event can&apos;t start like this.
        </p>
      )}

      <ConquestMapCanvas
        tiles={canvasTiles}
        regions={canvasRegions}
        background={fromMap.background}
        space={fromMap.space}
        colors={colors}
        maxDefense={map.settings.max_defense}
        edges={editable ? liveEdges(draft) : fromMap.edges}
        showEdges={editable && connecting}
        selectedKey={connecting ? connectFrom : selected}
        editable={editable && !connecting}
        onSelect={editable ? onTileClick : setSelected}
        onMove={(key, x, y) => patchTile(key, (t) => ({ ...t, x: clamp01(x), y: clamp01(y) }))}
      />

      {editable && !connecting && selectedTile && (
        <TileEditor
          tile={selectedTile}
          regions={draft.regions}
          teams={event.teams}
          settings={map.settings}
          eligible={eligibleTasks}
          onChange={(fn) => patchTile(selectedTile.key, fn)}
          onDelete={() => {
            patchDraft((d) => ({
              ...d,
              tiles: d.tiles.filter((t) => t.key !== selectedTile.key),
              edges: d.edges.filter(([a, b]) => a !== selectedTile.key && b !== selectedTile.key),
            }));
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}

      {editable && <RegionsEditor draft={draft} onChange={patchDraft} />}

      {editable && draft.regions.length > 0 && (
        <HotZonesEditor
          draft={draft}
          onChange={patchDraft}
          window={{ start: event.starts_at ?? null, end: event.ends_at ?? null }}
          seed={event.id}
        />
      )}

      {editable && (
        <div className="border-osrs-bronze/25 bg-osrs-brown-dark/95 sticky bottom-0 z-40 flex flex-wrap items-center gap-3 rounded border p-3">
          <Button
            type="button"
            onClick={onSave}
            disabled={pending || !dirty || problems.length > 0}
          >
            {pending ? "Saving…" : "Save map"}
          </Button>
          {dirty && (
            <button
              type="button"
              className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-sm"
              onClick={() => {
                setDraft(draftFromMap(map));
                setDirty(false);
              }}
            >
              Discard changes
            </button>
          )}
          {problems.length > 0 ? (
            <span className="text-osrs-red text-xs">{problems[0]}</span>
          ) : dirty ? (
            <span className="text-osrs-gold-bright text-xs">Unsaved changes</span>
          ) : (
            <span className="text-osrs-parchment-dark/60 text-xs">All changes saved</span>
          )}
        </div>
      )}

      <ConquestSettingsForm groupId={groupId} eventId={event.id} initial={map.settings} />

      {!editable && event.status === "active" && (
        <ConquestLiveTools
          groupId={groupId}
          eventId={event.id}
          map={map}
          teams={event.teams}
          onChanged={async () => {
            const res = await fetchConquestMap(groupId, event.id);
            if (res.ok) adopt(res.data);
          }}
        />
      )}
    </div>
  );
}

/** An optional whole number: "" = null (the map's rule). */
function optionalInt(raw: string, lo: number, hi: number): number | null {
  if (raw.trim() === "") return null;
  const n = Math.round(Number(raw));
  return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : null;
}

function troopCount(raw: string): number {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), MAX_TROOPS_PER_RULE) : 1;
}

function TileEditor({
  tile,
  regions,
  teams,
  settings,
  eligible,
  onChange,
  onDelete,
  onClose,
}: {
  tile: DraftTile;
  regions: ConquestDraft["regions"];
  teams: EventDetail["teams"];
  settings: ConquestMap["settings"];
  eligible: EventTask[];
  onChange: (fn: (t: DraftTile) => DraftTile) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [addTask, setAddTask] = useState<string>("");
  const [addTroops, setAddTroops] = useState(1);
  return (
    <section className="border-osrs-bronze/30 bg-osrs-brown-dark/30 space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-osrs-gold text-base font-semibold">{tile.label || "New tile"}</h4>
        <button
          type="button"
          onClick={onClose}
          className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-sm"
        >
          Close
        </button>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1">
          <span className="text-osrs-parchment-dark/70 block text-xs">Name</span>
          <input
            className={`${input} w-full`}
            value={tile.label}
            maxLength={80}
            onChange={(e) => onChange((t) => ({ ...t, label: e.target.value }))}
          />
        </label>
        <label className="space-y-1">
          <span className="text-osrs-parchment-dark/70 block text-xs">Region</span>
          <select
            className={`${input} w-full`}
            value={tile.region_key ?? ""}
            onChange={(e) => onChange((t) => ({ ...t, region_key: e.target.value || null }))}
          >
            <option value="">No region</option>
            {regions.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-osrs-parchment-dark/70 block text-xs">Points while held</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            className={`${input} w-full`}
            value={tile.value}
            onChange={(e) =>
              onChange((t) => ({ ...t, value: Math.max(0, Number(e.target.value) || 0) }))
            }
          />
        </label>
        <label className="space-y-1">
          <span className="text-osrs-parchment-dark/70 block text-xs">Kind</span>
          <select
            className={`${input} w-full`}
            value={tile.kind}
            onChange={(e) =>
              onChange((t) => ({ ...t, kind: e.target.value === "respawn" ? "respawn" : "normal" }))
            }
          >
            <option value="normal">Territory</option>
            <option value="respawn">Respawn point (can't be owned)</option>
          </select>
        </label>
      </div>

      {tile.kind === "normal" && (
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <label className="space-y-1">
            <span className="text-osrs-parchment-dark/70 block text-xs">Most defense</span>
            <input
              type="number"
              min={1}
              max={20}
              placeholder={`Map rule (${settings.max_defense})`}
              className={`${input} w-full`}
              value={tile.max_defense ?? ""}
              onChange={(e) =>
                onChange((t) => ({ ...t, max_defense: optionalInt(e.target.value, 1, 20) }))
              }
            />
          </label>
          <label className="space-y-1">
            <span className="text-osrs-parchment-dark/70 block text-xs">
              Garrison while unowned
            </span>
            <input
              type="number"
              min={0}
              max={20}
              placeholder={`Map rule (${settings.neutral_defense})`}
              className={`${input} w-full`}
              value={tile.garrison ?? ""}
              onChange={(e) =>
                onChange((t) => ({ ...t, garrison: optionalInt(e.target.value, 0, 20) }))
              }
            />
          </label>
          <label className="space-y-1">
            <span className="text-osrs-parchment-dark/70 block text-xs">Home of</span>
            <select
              className={`${input} w-full`}
              value={tile.home_team_id ?? ""}
              onChange={(e) =>
                onChange((t) => ({
                  ...t,
                  home_team_id: e.target.value ? Number(e.target.value) : null,
                }))
              }
            >
              <option value="">No team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-osrs-parchment-dark/50 text-xs sm:col-span-3">
            Leave the defense boxes empty to use the map&apos;s rules.
            {settings.start_mode === "homes"
              ? " Each team starts on its home tile, and comes back there if it loses everything."
              : " Homes are used when teams start on a tile the organiser picks (see Rules)."}
          </p>
        </div>
      )}

      {tile.kind === "normal" && (
        <div className="space-y-2">
          <p className="text-osrs-parchment-dark/70 text-xs font-semibold uppercase tracking-wide">
            What earns troops here
          </p>
          {tile.rules.length === 0 && (
            <p className="text-osrs-red text-xs">
              Add at least one task, or the tile can never be taken.
            </p>
          )}
          {tile.rules.map((rule, i) => (
            <div key={rule.task_id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-osrs-parchment min-w-0 flex-1 truncate">{rule.label}</span>
              <label className="text-osrs-parchment-dark/70 flex items-center gap-1 text-xs">
                <input
                  type="number"
                  min={1}
                  max={MAX_TROOPS_PER_RULE}
                  className={`${input} w-16`}
                  value={rule.troops}
                  onChange={(e) =>
                    onChange((t) => ({
                      ...t,
                      rules: t.rules.map((r, j) =>
                        j === i ? { ...r, troops: troopCount(e.target.value) } : r,
                      ),
                    }))
                  }
                  aria-label="Troops"
                />
                troops
              </label>
              <label className="text-osrs-parchment-dark/70 flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={rule.once}
                  onChange={(e) =>
                    onChange((t) => ({
                      ...t,
                      rules: t.rules.map((r, j) =>
                        j === i ? { ...r, once: e.target.checked } : r,
                      ),
                    }))
                  }
                />
                only once
              </label>
              {settings.phase_count > 1 && (
                <select
                  className={input}
                  value={rule.phase}
                  aria-label="Phase"
                  onChange={(e) =>
                    onChange((t) => ({
                      ...t,
                      rules: t.rules.map((r, j) =>
                        j === i ? { ...r, phase: Number(e.target.value) } : r,
                      ),
                    }))
                  }
                >
                  <option value={0}>Every phase</option>
                  {Array.from({ length: settings.phase_count }, (_, n) => n + 1).map((n) => (
                    <option key={n} value={n}>
                      Phase {n} only
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                className="text-osrs-parchment-dark/60 hover:text-osrs-red text-xs"
                onClick={() =>
                  onChange((t) => ({ ...t, rules: t.rules.filter((_, j) => j !== i) }))
                }
              >
                Remove
              </button>
            </div>
          ))}
          {tile.rules.length < MAX_RULES_PER_TILE && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <select
                className={`${input} min-w-0 flex-1`}
                value={addTask}
                onChange={(e) => setAddTask(e.target.value)}
                aria-label="Task to add"
              >
                <option value="">
                  {eligible.length
                    ? "Add a task from this event…"
                    : "No unused tasks can drive a tile"}
                </option>
                {eligible.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <label className="text-osrs-parchment-dark/70 flex items-center gap-1 text-xs">
                <input
                  type="number"
                  min={1}
                  max={MAX_TROOPS_PER_RULE}
                  className={`${input} w-16`}
                  value={addTroops}
                  onChange={(e) => setAddTroops(troopCount(e.target.value))}
                  aria-label="Troops for the new task"
                />
                troops
              </label>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={!addTask}
                onClick={() => {
                  const task = eligible.find((t) => String(t.id) === addTask);
                  if (!task) return;
                  onChange((t) => ({
                    ...t,
                    rules: [
                      ...t.rules,
                      {
                        task_id: task.id,
                        troops: addTroops,
                        label: task.label,
                        once: false,
                        phase: 0,
                      },
                    ],
                  }));
                  setAddTask("");
                }}
              >
                Add
              </Button>
            </div>
          )}
          <p className="text-osrs-parchment-dark/50 text-xs">
            Every time a team reaches the task&apos;s target again, it earns the troops. Tick
            &quot;only once&quot; for an achievement that pays a single time (a first pet, a rare
            drop). Make new tasks, or change a task&apos;s target, in the Tasks tab (kills, items,
            XP, loot value, pets, combat achievements, slayer tasks or manual).
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onDelete}
        className="text-osrs-red/80 hover:text-osrs-red text-sm"
      >
        Delete this tile
      </button>
    </section>
  );
}

function RegionsEditor({
  draft,
  onChange,
}: {
  draft: ConquestDraft;
  onChange: (fn: (d: ConquestDraft) => ConquestDraft) => void;
}) {
  if (!draft.regions.length) return null;
  const counts = new Map<string, number>();
  for (const t of draft.tiles) {
    if (t.region_key) counts.set(t.region_key, (counts.get(t.region_key) ?? 0) + 1);
  }
  return (
    <section className="space-y-2">
      <h4 className="text-osrs-gold text-base font-semibold">Regions</h4>
      <p className="text-osrs-parchment-dark/60 text-xs">
        Holding every tile of a region pays its bonus on top of the tiles. A contested centre
        multiplies its bonus and its tiles&apos; points (set how much in Rules), so every team wants
        it.
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        {draft.regions.map((r, i) => (
          <div
            key={r.key}
            className="border-osrs-bronze/25 flex flex-wrap items-center gap-2 rounded border p-2 text-sm"
          >
            <input
              type="color"
              value={r.color ?? REGION_COLORS[i % REGION_COLORS.length]!}
              onChange={(e) =>
                onChange((d) => ({
                  ...d,
                  regions: d.regions.map((x) =>
                    x.key === r.key ? { ...x, color: e.target.value } : x,
                  ),
                }))
              }
              className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
              aria-label={`${r.name} colour`}
            />
            <input
              className={`${input} min-w-0 flex-1`}
              value={r.name}
              maxLength={60}
              onChange={(e) =>
                onChange((d) => ({
                  ...d,
                  regions: d.regions.map((x) =>
                    x.key === r.key ? { ...x, name: e.target.value } : x,
                  ),
                }))
              }
              aria-label="Region name"
            />
            <label className="text-osrs-parchment-dark/70 flex items-center gap-1 text-xs">
              Bonus
              <input
                type="number"
                min={0}
                max={1000}
                step={0.5}
                className={`${input} w-16`}
                value={r.bonus}
                onChange={(e) =>
                  onChange((d) => ({
                    ...d,
                    regions: d.regions.map((x) =>
                      x.key === r.key
                        ? { ...x, bonus: Math.max(0, Number(e.target.value) || 0) }
                        : x,
                    ),
                  }))
                }
              />
            </label>
            <label className="text-osrs-parchment-dark/70 flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={r.contested}
                onChange={(e) =>
                  onChange((d) => ({
                    ...d,
                    regions: d.regions.map((x) =>
                      x.key === r.key ? { ...x, contested: e.target.checked } : x,
                    ),
                  }))
                }
              />
              Contested centre
            </label>
            <span className="text-osrs-parchment-dark/60 text-xs">
              {counts.get(r.key) ?? 0} tiles
            </span>
            <button
              type="button"
              className="text-osrs-parchment-dark/60 hover:text-osrs-red text-xs"
              onClick={() =>
                onChange((d) => ({
                  ...d,
                  regions: d.regions.filter((x) => x.key !== r.key),
                  tiles: d.tiles.map((t) =>
                    t.region_key === r.key ? { ...t, region_key: null } : t,
                  ),
                  hotzones: d.hotzones.filter((z) => z.region_key !== r.key),
                }))
              }
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function toLocalInput(unix: number): string {
  const d = new Date(unix * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function HotZonesEditor({
  draft,
  onChange,
  window,
  seed,
}: {
  draft: ConquestDraft;
  onChange: (fn: (d: ConquestDraft) => ConquestDraft) => void;
  window: { start: number | null; end: number | null };
  seed: number;
}) {
  const [every, setEvery] = useState(24);
  const [length, setLength] = useState(12);
  const regionName = new Map(draft.regions.map((r) => [r.key, r.name]));
  const zones = [...draft.hotzones].sort((a, b) => a.starts_at - b.starts_at);
  const canPlan = window.start != null && window.end != null;
  const patchZone = (key: string, fn: (z: DraftHotZone) => DraftHotZone) =>
    onChange((d) => ({ ...d, hotzones: d.hotzones.map((z) => (z.key === key ? fn(z) : z)) }));
  return (
    <section className="space-y-2">
      <h4 className="text-osrs-gold text-base font-semibold">Hot zones</h4>
      <p className="text-osrs-parchment-dark/60 text-xs">
        While a region is hot, troops earned on its tiles count double, so the fighting moves around
        the map. Everyone can see the plan ahead of time, and Discord announces each one when it
        starts.
      </p>
      {canPlan && (
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <label className="space-y-1">
            <span className="text-osrs-parchment-dark/70 block text-xs">A new region every</span>
            <select
              className={input}
              value={every}
              onChange={(e) => setEvery(Number(e.target.value))}
            >
              {[12, 24, 48].map((h) => (
                <option key={h} value={h}>
                  {h} hours
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-osrs-parchment-dark/70 block text-xs">Hot for</span>
            <select
              className={input}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
            >
              {[6, 12, 24].map((h) => (
                <option key={h} value={h}>
                  {h} hours
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              onChange((d) => ({
                ...d,
                hotzones: planHotZones(
                  d.regions.map((r) => r.key),
                  window.start!,
                  window.end!,
                  every,
                  Math.min(length, every),
                  seed,
                ),
              }))
            }
          >
            {zones.length ? "Replan" : "Plan hot zones"}
          </Button>
          {zones.length > 0 && (
            <button
              type="button"
              className="text-osrs-parchment-dark/60 hover:text-osrs-red text-xs"
              onClick={() => onChange((d) => ({ ...d, hotzones: [] }))}
            >
              Clear all
            </button>
          )}
        </div>
      )}
      {!canPlan && (
        <p className="text-osrs-parchment-dark/60 text-xs">
          Set the event&apos;s start and end dates to plan hot zones.
        </p>
      )}
      {zones.length > 0 && (
        <ul className="space-y-1 text-sm">
          {zones.map((z) => (
            <li key={z.key} className="flex flex-wrap items-center gap-2">
              <select
                className={input}
                value={z.region_key}
                aria-label="Region"
                onChange={(e) => patchZone(z.key, (x) => ({ ...x, region_key: e.target.value }))}
              >
                {draft.regions.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                className={input}
                aria-label="Starts"
                value={toLocalInput(z.starts_at)}
                onChange={(e) => {
                  const t = new Date(e.target.value).getTime();
                  if (Number.isFinite(t)) patchZone(z.key, (x) => ({ ...x, starts_at: t / 1000 }));
                }}
              />
              <label className="text-osrs-parchment-dark/70 flex items-center gap-1 text-xs">
                for
                <input
                  type="number"
                  min={1}
                  max={168}
                  className={`${input} w-16`}
                  value={z.hours}
                  onChange={(e) =>
                    patchZone(z.key, (x) => ({
                      ...x,
                      hours: Math.min(Math.max(Number(e.target.value) || 1, 1), 168),
                    }))
                  }
                />
                hours
              </label>
              <span className="text-osrs-parchment-dark/50 text-xs">
                {regionName.get(z.region_key)}
              </span>
              <button
                type="button"
                className="text-osrs-parchment-dark/60 hover:text-osrs-red text-xs"
                onClick={() =>
                  onChange((d) => ({ ...d, hotzones: d.hotzones.filter((x) => x.key !== z.key) }))
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
