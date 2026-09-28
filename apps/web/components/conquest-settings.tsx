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
  CONQUEST_ATTACK_RANGES,
  CONQUEST_BATTLE_MODES,
  CONQUEST_COMEBACK_HOURS,
  CONQUEST_COMEBACK_MODES,
  CONQUEST_CONTESTED_MULTIPLIERS,
  CONQUEST_MAX_PHASES,
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
const SCORING_HINTS: Record<(typeof CONQUEST_SCORING_MODES)[number], string> = {
  hold_time: "Points build up while a team holds land and are kept after losing it.",
  final:
    "Nothing builds up. Losing a tile loses its points. Standings are settled when the event ends.",
};
const BATTLE_LABELS: Record<(typeof CONQUEST_BATTLE_MODES)[number], string> = {
  dice: "Dice battles (Risk rules)",
  attrition: "No dice: each attack removes one defense",
};
const START_LABELS: Record<(typeof CONQUEST_START_MODES)[number], string> = {
  neutral: "Every tile starts unowned (a land grab)",
  dealt: "Deal the tiles out evenly between the teams",
  scattered: "Each team starts on one random tile, spread apart",
  homes: "Each team starts on a home tile you pick",
};
const START_HINTS: Record<(typeof CONQUEST_START_MODES)[number], string> = {
  neutral: "A team with no land can claim any tile.",
  dealt: "Every tile has an owner from the start.",
  scattered: "A team that loses everything can come back in anywhere.",
  homes:
    "Pick each team's home in the map designer. A team that loses everything comes back there.",
};
const COMEBACK_LABELS: Record<(typeof CONQUEST_COMEBACK_MODES)[number], string> = {
  none: "No help",
  shield: "A shield: its tiles can't be attacked",
  boost: "A boost: its troops count double",
};
const RANGE_LABELS: Record<(typeof CONQUEST_ATTACK_RANGES)[number], string> = {
  adjacent: "Only tiles next to their own",
  anywhere: "Any tile on the map",
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
          Battle rules apply from the next troop. Changing the scoring recalculates every
          team&apos;s score for the whole event, and it locks once the event ends.
        </p>
      </div>
      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <fieldset className="space-y-1.5 text-sm">
          <legend className="text-osrs-parchment-dark/70 mb-1 text-xs">Scoring</legend>
          {CONQUEST_SCORING_MODES.map((mode) => (
            <label key={mode} className="flex items-start gap-2">
              <input
                type="radio"
                name="scoring_mode"
                className="mt-1"
                checked={form.scoring_mode === mode}
                onChange={() => set("scoring_mode", mode)}
              />
              <span>
                <span className="text-osrs-parchment block">{SCORING_LABELS[mode]}</span>
                <span className="text-osrs-parchment-dark/50 block text-[11px]">
                  {SCORING_HINTS[mode]}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset className="space-y-1.5 text-sm">
          <legend className="text-osrs-parchment-dark/70 mb-1 text-xs">Teams can attack</legend>
          {CONQUEST_ATTACK_RANGES.map((mode) => (
            <label key={mode} className="flex items-center gap-2">
              <input
                type="radio"
                name="attack_range"
                checked={form.attack_range === mode}
                onChange={() => set("attack_range", mode)}
              />
              <span className="text-osrs-parchment">{RANGE_LABELS[mode]}</span>
            </label>
          ))}
          <span className="text-osrs-parchment-dark/50 block text-[11px]">
            {form.attack_range === "adjacent"
              ? "Troops only count on a team's own tiles and the ones connected to them. Troops earned anywhere else are wasted."
              : "Troops count wherever they're earned."}
          </span>
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
            <label key={mode} className="flex items-start gap-2">
              <input
                type="radio"
                name="start_mode"
                className="mt-1"
                checked={form.start_mode === mode}
                onChange={() => set("start_mode", mode)}
              />
              <span>
                <span className="text-osrs-parchment block">{START_LABELS[mode]}</span>
                <span className="text-osrs-parchment-dark/50 block text-[11px]">
                  {START_HINTS[mode]}
                </span>
              </span>
            </label>
          ))}
          <div className="flex flex-wrap gap-4 pt-1">
            {form.start_mode !== "neutral" && (
              <Num
                label="Defense on starting tiles"
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

      <div className="space-y-3">
        <h5 className="text-osrs-gold text-sm font-semibold">Fairness</h5>
        <div className="flex flex-wrap gap-4">
          <Num
            label="Retreat"
            hint="When a team loses a tile, its weakest tile next to it gains this much defense. 0 = off."
            value={form.retreat_defense}
            min={0}
            max={5}
            onChange={(n) => set("retreat_defense", n)}
          />
          <Num
            label="Bounty on the leader"
            hint="Points for taking a tile from the team in first place, less for lower teams, nothing for last place. 0 = off."
            value={form.bounty_points}
            min={0}
            max={20}
            onChange={(n) => set("bounty_points", n)}
          />
          <Num
            label="Phases"
            hint="Splits the event evenly. Tasks can be set to play in one phase only."
            value={form.phase_count}
            min={1}
            max={CONQUEST_MAX_PHASES}
            onChange={(n) => set("phase_count", n)}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.underdog_defense === "on"}
              onChange={(e) => set("underdog_defense", e.target.checked ? "on" : "off")}
            />
            <span>
              <span className="text-osrs-parchment block">The smallest team defends harder</span>
              <span className="text-osrs-parchment-dark/50 block text-[11px]">
                The team with the fewest tiles rolls an extra defense die. With no dice, every other
                attack on it is absorbed. Makes ganging up on the weakest team slow.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.capitals === "safe"}
              onChange={(e) => set("capitals", e.target.checked ? "safe" : "normal")}
            />
            <span>
              <span className="text-osrs-parchment block">Home tiles can&apos;t be captured</span>
              <span className="text-osrs-parchment-dark/50 block text-[11px]">
                A team&apos;s home tile never drops below 1 defense, so no team can be wiped out.
                With one random tile each, that tile is the team&apos;s home.
              </span>
            </span>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-osrs-parchment-dark/70 block text-xs">
              A team that loses everything and fights its way back gets
            </span>
            <span className="flex flex-wrap gap-2">
              <select
                className={input}
                value={form.comeback}
                onChange={(e) =>
                  set("comeback", e.target.value as (typeof CONQUEST_COMEBACK_MODES)[number])
                }
              >
                {CONQUEST_COMEBACK_MODES.map((m) => (
                  <option key={m} value={m}>
                    {COMEBACK_LABELS[m]}
                  </option>
                ))}
              </select>
              {form.comeback !== "none" && (
                <select
                  className={input}
                  value={form.comeback_hours}
                  onChange={(e) => set("comeback_hours", Number(e.target.value))}
                  aria-label="For how long"
                >
                  {CONQUEST_COMEBACK_HOURS.map((h) => (
                    <option key={h} value={h}>
                      for {h} hours
                    </option>
                  ))}
                </select>
              )}
            </span>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-osrs-parchment-dark/70 block text-xs">
              The contested centre is worth
            </span>
            <select
              className={input}
              value={form.contested_multiplier}
              onChange={(e) => set("contested_multiplier", Number(e.target.value))}
            >
              {CONQUEST_CONTESTED_MULTIPLIERS.map((m) => (
                <option key={m} value={m}>
                  {m}x points
                </option>
              ))}
            </select>
            <span className="text-osrs-parchment-dark/50 block text-[11px]">
              Mark the contested region in the map designer. None marked = off.
            </span>
          </label>
        </div>
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
