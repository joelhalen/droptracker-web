"use client";

/**
 * Conquest settings + live corrections (web120a), mounted under the map
 * designer in the event manager.
 *
 * Settings are live-tunable: dice, defense caps and the summary cadence take
 * effect on the next troop or sweep; the start options only matter when the
 * event starts. The live tools let an organiser hand a tile to a team (or
 * back to nobody) and set its defense while the event runs, for fixing a
 * mistake; the change is logged in the battle log and the audit log.
 */
import { useState, useTransition } from "react";
import type { ConquestMap, ConquestSettings, EventTeam } from "@droptracker/api-types";
import {
  CONQUEST_BATTLE_MODES,
  CONQUEST_SCORING_MODES,
  CONQUEST_START_MODES,
  CONQUEST_SUMMARY_HOURS,
} from "@droptracker/api-types";
import {
  adjustConquestTile,
  saveConquestSettings,
} from "@/app/(site)/(admin)/groups/[id]/events/conquest-actions";
import { Alert, Button } from "@/components/ui";

const input =
  "border-osrs-bronze/40 bg-osrs-brown-dark/60 text-osrs-parchment focus:border-osrs-gold/70 rounded border px-2 py-1 text-sm outline-none";

const SCORING_LABELS: Record<(typeof CONQUEST_SCORING_MODES)[number], string> = {
  hold_time: "Points for every hour a tile or region is held",
  final: "Only the map at the end counts",
};
const BATTLE_LABELS: Record<(typeof CONQUEST_BATTLE_MODES)[number], string> = {
  dice: "Dice battles (Risk rules)",
  attrition: "No dice: each attack removes one defense",
};
const START_LABELS: Record<(typeof CONQUEST_START_MODES)[number], string> = {
  neutral: "Every tile starts unowned (a land grab)",
  dealt: "Deal the tiles out evenly between the teams",
};

function Num({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-osrs-parchment-dark/70 block text-xs">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        className={`${input} w-24`}
        value={value}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          if (Number.isFinite(n)) onChange(Math.min(Math.max(n, min), max));
        }}
      />
      {hint && <span className="text-osrs-parchment-dark/50 block text-[11px]">{hint}</span>}
    </label>
  );
}

export function ConquestSettingsForm({
  groupId,
  eventId,
  initial,
}: {
  groupId: number | null;
  eventId: number;
  initial: ConquestSettings;
}) {
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(saved) !== JSON.stringify(form);
  const set = <K extends keyof ConquestSettings>(key: K, value: ConquestSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSave = () => {
    setError(null);
    const patch: Partial<ConquestSettings> = {};
    for (const key of Object.keys(form) as (keyof ConquestSettings)[]) {
      if (form[key] !== saved[key]) (patch as Record<string, unknown>)[key] = form[key];
    }
    startTransition(async () => {
      const res = await saveConquestSettings(groupId, eventId, patch);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSaved(res.data);
      setForm(res.data);
    });
  };

  return (
    <section className="border-osrs-bronze/30 space-y-4 rounded-lg border p-4">
      <div>
        <h4 className="text-osrs-gold text-base font-semibold">Rules</h4>
        <p className="text-osrs-parchment-dark/60 text-xs">
          These can change at any time. Changes apply from the next troop.
        </p>
      </div>
      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className="space-y-1.5 text-sm">
          <legend className="text-osrs-parchment-dark/70 mb-1 text-xs">Scoring</legend>
          {CONQUEST_SCORING_MODES.map((mode) => (
            <label key={mode} className="flex items-center gap-2">
              <input
                type="radio"
                name="scoring_mode"
                checked={form.scoring_mode === mode}
                onChange={() => set("scoring_mode", mode)}
              />
              <span className="text-osrs-parchment">{SCORING_LABELS[mode]}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="space-y-1.5 text-sm">
          <legend className="text-osrs-parchment-dark/70 mb-1 text-xs">Battles</legend>
          {CONQUEST_BATTLE_MODES.map((mode) => (
            <label key={mode} className="flex items-center gap-2">
              <input
                type="radio"
                name="battle_mode"
                checked={form.battle_mode === mode}
                onChange={() => set("battle_mode", mode)}
              />
              <span className="text-osrs-parchment">{BATTLE_LABELS[mode]}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <div className="flex flex-wrap gap-4">
        {form.battle_mode === "dice" && (
          <>
            <Num
              label="Attack dice"
              value={form.attack_dice}
              min={1}
              max={3}
              onChange={(n) => set("attack_dice", n)}
            />
            <Num
              label="Most defense dice"
              value={form.defense_dice}
              min={1}
              max={3}
              onChange={(n) => set("defense_dice", n)}
            />
          </>
        )}
        <Num
          label="Most defense a tile can have"
          value={form.max_defense}
          min={1}
          max={20}
          onChange={(n) => set("max_defense", n)}
        />
        <Num
          label="Defense after a capture"
          hint="The troop that takes a tile stays to guard it."
          value={form.capture_defense}
          min={0}
          max={form.max_defense}
          onChange={(n) => set("capture_defense", n)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className="space-y-1.5 text-sm">
          <legend className="text-osrs-parchment-dark/70 mb-1 text-xs">At the start</legend>
          {CONQUEST_START_MODES.map((mode) => (
            <label key={mode} className="flex items-center gap-2">
              <input
                type="radio"
                name="start_mode"
                checked={form.start_mode === mode}
                onChange={() => set("start_mode", mode)}
              />
              <span className="text-osrs-parchment">{START_LABELS[mode]}</span>
            </label>
          ))}
          <div className="flex flex-wrap gap-4 pt-1">
            {form.start_mode === "dealt" && (
              <Num
                label="Defense on dealt tiles"
                value={form.start_defense}
                min={0}
                max={form.max_defense}
                onChange={(n) => set("start_defense", n)}
              />
            )}
            <Num
              label="Defense on unowned tiles"
              hint="Above 0, the first troop has to fight for it."
              value={form.neutral_defense}
              min={0}
              max={form.max_defense}
              onChange={(n) => set("neutral_defense", n)}
            />
          </div>
        </fieldset>
        <label className="space-y-1 text-sm">
          <span className="text-osrs-parchment-dark/70 block text-xs">Discord map update</span>
          <select
            className={input}
            value={form.summary_hours}
            onChange={(e) => set("summary_hours", Number(e.target.value))}
          >
            {CONQUEST_SUMMARY_HOURS.map((h) => (
              <option key={h} value={h}>
                {h === 0 ? "Never" : `Every ${h} hours`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" size="sm" onClick={onSave} disabled={!dirty || pending}>
          {pending ? "Saving…" : "Save rules"}
        </Button>
        {dirty && (
          <button
            type="button"
            className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-sm"
            onClick={() => setForm(saved)}
          >
            Undo
          </button>
        )}
      </div>
    </section>
  );
}

export function ConquestLiveTools({
  groupId,
  eventId,
  map,
  teams,
  onChanged,
}: {
  groupId: number | null;
  eventId: number;
  map: ConquestMap;
  teams: EventTeam[];
  onChanged: () => Promise<void> | void;
}) {
  const ownable = map.tiles.filter((t) => t.kind !== "respawn");
  const [tileId, setTileId] = useState<number | null>(ownable[0]?.id ?? null);
  const tile = ownable.find((t) => t.id === tileId) ?? null;
  const [owner, setOwner] = useState<string>(
    tile?.owner_team_id != null ? String(tile.owner_team_id) : "",
  );
  const [defense, setDefense] = useState<number>(tile?.defense ?? 0);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const pick = (id: number) => {
    const next = ownable.find((t) => t.id === id);
    setTileId(id);
    setOwner(next?.owner_team_id != null ? String(next.owner_team_id) : "");
    setDefense(next?.defense ?? 0);
    setMessage(null);
  };

  const onApply = () => {
    if (tileId == null) return;
    startTransition(async () => {
      const res = await adjustConquestTile(groupId, eventId, tileId, {
        owner_team_id: owner ? Number(owner) : null,
        defense,
      });
      if (!res.ok) {
        setMessage({ ok: false, text: res.message });
        return;
      }
      setMessage({ ok: true, text: "Tile updated. Scores catch up within a minute." });
      await onChanged();
    });
  };

  if (!ownable.length) return null;
  return (
    <section className="border-osrs-bronze/30 space-y-3 rounded-lg border p-4">
      <div>
        <h4 className="text-osrs-gold text-base font-semibold">Correct a tile</h4>
        <p className="text-osrs-parchment-dark/60 text-xs">
          For fixing a mistake. The change shows in the battle log as an organiser correction and
          doesn&apos;t post to Discord.
        </p>
      </div>
      {message && <Alert variant={message.ok ? "success" : "error"}>{message.text}</Alert>}
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="space-y-1">
          <span className="text-osrs-parchment-dark/70 block text-xs">Tile</span>
          <select
            className={input}
            value={tileId ?? ""}
            onChange={(e) => pick(Number(e.target.value))}
          >
            {ownable.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-osrs-parchment-dark/70 block text-xs">Owner</span>
          <select className={input} value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Nobody</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <Num
          label="Defense"
          value={defense}
          min={0}
          max={map.settings.max_defense}
          onChange={setDefense}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onApply}
          disabled={pending || !tile}
        >
          {pending ? "Saving…" : "Apply"}
        </Button>
      </div>
    </section>
  );
}
