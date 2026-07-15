"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CONFIG_CATEGORIES,
  GROUP_CONFIG_FIELDS,
  getConfigField,
  type ConfigField,
  type GroupSubscription,
  type SubscriptionTier,
} from "@droptracker/api-types";
import {
  saveGroupConfig,
  fetchGroupDiscordChannels,
  fetchGroupPbBosses,
  fetchLootboardStyles,
} from "@/app/(site)/(admin)/groups/[id]/settings/actions";
import { getErrorMessage } from "@/lib/errors";
import { hasEntitlement } from "@/lib/entitlements";
import { Alert, Card, fieldInputClass } from "@/components/ui";
import { ChannelListDelayHint, DiscordChannelPicker } from "@/components/discord-channel-picker";
import { BossListPicker } from "@/components/boss-list-picker";
import { BoardStylePicker } from "@/components/board-style-picker";
import type { DiscordChannel, LootboardStyle } from "@/lib/api";

type ConfigValue = string | number | boolean | null;
type ConfigMap = Record<string, ConfigValue>;

/**
 * Coerce a raw config value (which the backend may serialize as a string, e.g.
 * "1"/"true"/"120000") into the type its field expects. Prevents footguns like
 * `Boolean("false") === true` when rendering checkbox/number inputs.
 */
function coerce(key: string, raw: ConfigValue): ConfigValue {
  const field = getConfigField(key);
  if (!field || raw == null) return raw ?? null;
  switch (field.type) {
    case "boolean":
      if (typeof raw === "boolean") return raw;
      return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
    case "int": {
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    default:
      return typeof raw === "string" ? raw : String(raw);
  }
}

/** Fields with a `seasonal_`-prefixed mirror, editable on the Seasonal tab. */
const SEASONAL_FIELDS = GROUP_CONFIG_FIELDS.filter((f) => f.seasonalMirror);
const seasonalKey = (key: string) => `seasonal_${key}`;
const SEASONAL_CATEGORY = { id: "seasonal", label: "Seasonal (Leagues)" };

function normalize(map: ConfigMap): ConfigMap {
  const out: ConfigMap = {};
  for (const f of GROUP_CONFIG_FIELDS) {
    out[f.key] = coerce(f.key, map[f.key] ?? null);
  }
  for (const f of SEASONAL_FIELDS) {
    const k = seasonalKey(f.key);
    out[k] = coerce(k, map[k] ?? null);
  }
  return out;
}

/** Anchor id for a category's card, used by the jump-to sidebar + scroll-spy. */
const sectionId = (categoryId: string) => `cfg-${categoryId}`;

export function ConfigEditor({
  groupId,
  initial,
  subscription = null,
  tiers: _tiers = [],
  isSuperadmin = false,
  seasonalActive = true,
}: {
  groupId: number;
  initial: ConfigMap;
  subscription?: GroupSubscription | null;
  tiers?: SubscriptionTier[];
  isSuperadmin?: boolean;
  /** Global seasonal-processing switch state (from GET /seasonal-status). */
  seasonalActive?: boolean;
}) {
  const normalized = useMemo(() => normalize(initial), [initial]);
  const [baseline, setBaseline] = useState<ConfigMap>(normalized);
  const [values, setValues] = useState<ConfigMap>(normalized);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetched once here (not per-field) since up to 9 fields share this same list.
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  // Boss names with stored PBs, for the Hall of Fame "bosslist" picker.
  const [bosses, setBosses] = useState<string[]>([]);
  // Lootboard style catalog for the "boardstyle" preview picker.
  const [boardStyles, setBoardStyles] = useState<LootboardStyle[]>([]);
  useEffect(() => {
    let active = true;
    fetchGroupDiscordChannels(groupId)
      .then((res) => {
        if (active) setChannels(res.channels);
      })
      .catch(() => {
        /* picker falls back to manual entry when the list is empty */
      });
    fetchGroupPbBosses(groupId)
      .then((res) => {
        if (active) setBosses(res.bosses);
      })
      .catch(() => {
        /* boss picker falls back to manual entry when the list is empty */
      });
    fetchLootboardStyles(groupId)
      .then((res) => {
        if (active) setBoardStyles(res.styles);
      })
      .catch(() => {
        /* style picker falls back to a numeric input when the list is empty */
      });
    return () => {
      active = false;
    };
  }, [groupId]);

  const categories = useMemo(
    () => [
      ...CONFIG_CATEGORIES.filter((cat) => GROUP_CONFIG_FIELDS.some((f) => f.category === cat.id)),
      SEASONAL_CATEGORY,
    ],
    [],
  );

  // Scroll-spy: highlight whichever category section is currently in view.
  const [activeCategory, setActiveCategory] = useState<string>(categories[0]?.id ?? "");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        // Prefer the entry closest to the top of the viewport.
        const topMost = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
        const id = topMost.target.id.replace(/^cfg-/, "");
        setActiveCategory(id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );
    for (const cat of categories) {
      const el = document.getElementById(sectionId(cat.id));
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [categories]);

  const isFieldLocked = (field: ConfigField) =>
    Boolean(
      field.entitlement &&
        !hasEntitlement(subscription, field.entitlement as "events" | "hall_of_fame", {
          isSuperadmin,
        }),
    );

  // Only send keys whose value changed (FRONTEND_PLAN.md §11.2 bulk upsert).
  const changed = useMemo(() => {
    const patch: ConfigMap = {};
    for (const f of GROUP_CONFIG_FIELDS) {
      if (isFieldLocked(f)) continue;
      const v = values[f.key] ?? null;
      if (v !== (baseline[f.key] ?? null)) patch[f.key] = v;
    }
    for (const f of SEASONAL_FIELDS) {
      if (isFieldLocked(f)) continue;
      const k = seasonalKey(f.key);
      const v = values[k] ?? null;
      if (v !== (baseline[k] ?? null)) patch[k] = v;
    }
    return patch;
  }, [values, baseline, subscription, isSuperadmin]);

  const dirtyCount = Object.keys(changed).length;
  const changedByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const key of Object.keys(changed)) {
      const field = getConfigField(key);
      if (!field) continue;
      // A key that resolved via prefix-stripping is a seasonal mirror.
      const cat = key !== field.key ? "seasonal" : field.category;
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }, [changed]);

  const set = (key: string, v: ConfigValue) => setValues((s) => ({ ...s, [key]: v }));

  const onReset = () => {
    setValues(baseline);
    setError(null);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirtyCount) return;
    setError(null);
    startTransition(async () => {
      try {
        await saveGroupConfig(groupId, changed);
        // Adopt the saved values as the new baseline.
        setBaseline({ ...baseline, ...changed });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't save configuration. Please try again."));
      }
    });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[13rem_1fr]">
      <aside className="hidden lg:block">
        <nav className="sticky top-24 space-y-0.5 text-sm">
          {categories.map((cat) => {
            const active = activeCategory === cat.id;
            const count = changedByCategory[cat.id];
            return (
              <a
                key={cat.id}
                href={`#${sectionId(cat.id)}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(sectionId(cat.id))?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 transition-colors ${
                  active
                    ? "bg-osrs-bronze text-osrs-parchment"
                    : "text-osrs-parchment-dark/80 hover:bg-osrs-surface-2"
                }`}
              >
                {cat.label}
                {count ? (
                  <span className="bg-osrs-gold text-osrs-brown-dark rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                    {count}
                  </span>
                ) : null}
              </a>
            );
          })}
        </nav>
      </aside>

      <form onSubmit={onSubmit} className="min-w-0 space-y-6 pb-24">
        {categories.map((cat) => {
          if (cat.id === "seasonal") {
            const toggles = SEASONAL_FIELDS.filter((f) => f.type === "boolean");
            const compact = SEASONAL_FIELDS.filter(
              (f) => !["boolean", "text", "csv", "bosslist"].includes(f.type),
            );
            return (
              <Card key={cat.id} id={sectionId(cat.id)} padding="p-6" className="scroll-mt-24">
                <h2 className="text-osrs-gold mb-1 text-lg font-semibold">{cat.label}</h2>
                <p className="text-osrs-parchment-dark/60 mb-4 text-xs">
                  Separate settings applied only to submissions from seasonal worlds (Leagues,
                  Deadman). Your main-world settings are unaffected.
                </p>
                {!seasonalActive && (
                  <div className="mb-4">
                    <Alert variant="info">
                      Seasonal processing is currently disabled globally — these settings will
                      take effect again when the next seasonal game mode goes live.
                    </Alert>
                  </div>
                )}
                {compact.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {compact.map((f) => (
                      <InputField
                        key={seasonalKey(f.key)}
                        field={f}
                        value={values[seasonalKey(f.key)] ?? f.default}
                        onChange={(v) => set(seasonalKey(f.key), v)}
                        channels={channels}
                        bosses={bosses}
                        boardStyles={boardStyles}
                        locked={isFieldLocked(f)}
                        groupId={groupId}
                      />
                    ))}
                  </div>
                )}
                {toggles.length > 0 && (
                  <div
                    className={`grid gap-3 sm:grid-cols-2 ${
                      compact.length > 0 ? "border-osrs-bronze/20 mt-5 border-t pt-5" : ""
                    }`}
                  >
                    {toggles.map((f) => (
                      <ToggleField
                        key={seasonalKey(f.key)}
                        field={f}
                        value={Boolean(values[seasonalKey(f.key)] ?? f.default)}
                        onChange={(v) => set(seasonalKey(f.key), v)}
                        locked={isFieldLocked(f)}
                        groupId={groupId}
                      />
                    ))}
                  </div>
                )}
              </Card>
            );
          }

          const fields = GROUP_CONFIG_FIELDS.filter((f) => f.category === cat.id);
          const toggles = fields.filter((f) => f.type === "boolean");
          const compact = fields.filter((f) => !["boolean", "text", "csv", "bosslist"].includes(f.type));
          const wide = fields.filter((f) => ["text", "csv", "bosslist"].includes(f.type));

          return (
            <Card key={cat.id} id={sectionId(cat.id)} padding="p-6" className="scroll-mt-24">
              <h2 className="text-osrs-gold mb-4 text-lg font-semibold">{cat.label}</h2>
              {fields.some((f) => f.type === "channel") && <ChannelListDelayHint className="-mt-3 mb-4" />}

              {compact.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {compact.map((f) => (
                    <InputField
                      key={f.key}
                      field={f}
                      value={values[f.key] ?? f.default}
                      onChange={(v) => set(f.key, v)}
                      channels={channels}
                      bosses={bosses}
                      boardStyles={boardStyles}
                      locked={isFieldLocked(f)}
                      groupId={groupId}
                    />
                  ))}
                </div>
              )}

              {wide.length > 0 && (
                <div className={`space-y-4 ${compact.length > 0 ? "mt-4" : ""}`}>
                  {wide.map((f) => (
                    <InputField
                      key={f.key}
                      field={f}
                      value={values[f.key] ?? f.default}
                      onChange={(v) => set(f.key, v)}
                      channels={channels}
                      bosses={bosses}
                      boardStyles={boardStyles}
                      locked={isFieldLocked(f)}
                      groupId={groupId}
                    />
                  ))}
                </div>
              )}

              {toggles.length > 0 && (
                <div
                  className={`grid gap-3 sm:grid-cols-2 ${
                    compact.length > 0 || wide.length > 0 ? "border-osrs-bronze/20 mt-5 border-t pt-5" : ""
                  }`}
                >
                  {toggles.map((f) => (
                    <ToggleField
                      key={f.key}
                      field={f}
                      value={Boolean(values[f.key] ?? f.default)}
                      onChange={(v) => set(f.key, v)}
                      locked={isFieldLocked(f)}
                      groupId={groupId}
                    />
                  ))}
                </div>
              )}
            </Card>
          );
        })}

        <div className="bg-osrs-surface-1/95 border-osrs-bronze/30 sticky bottom-0 -mx-1 space-y-2 rounded-lg border px-4 py-3 shadow-lg backdrop-blur">
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!dirtyCount || pending}
              className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? "Saving…" : `Save ${dirtyCount || ""} change${dirtyCount === 1 ? "" : "s"}`.trim()}
            </button>
            {dirtyCount > 0 && !pending && (
              <button
                type="button"
                onClick={onReset}
                className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-sm"
              >
                Discard changes
              </button>
            )}
            {saved && <span className="text-osrs-green text-sm">Saved.</span>}
          </div>
        </div>
      </form>
    </div>
  );
}

/** WAI-ARIA switch pattern — a single focusable element, not a checkbox + separate label. */
function ToggleField({
  field,
  value,
  onChange,
  locked = false,
  groupId,
}: {
  field: ConfigField;
  value: boolean;
  onChange: (v: boolean) => void;
  locked?: boolean;
  groupId: number;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-disabled={locked}
      disabled={locked}
      onClick={() => !locked && onChange(!value)}
      className="border-osrs-bronze/15 hover:border-osrs-gold/40 bg-osrs-surface-2/50 flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">
          {field.label}
          {locked ? <span className="text-osrs-parchment-dark/50 ml-1 text-xs">🔒 Premium</span> : null}
        </span>
        <span className="text-osrs-parchment-dark/60 mt-0.5 block text-xs">{field.help}</span>
        {locked ? <LockedFieldHint groupId={groupId} /> : null}
      </span>
      <span
        aria-hidden="true"
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          value ? "bg-osrs-gold" : "bg-osrs-stone/50"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 transform rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

function InputField({
  field,
  value,
  onChange,
  channels,
  bosses,
  boardStyles = [],
  locked = false,
  groupId,
}: {
  field: ConfigField;
  value: ConfigValue;
  onChange: (v: ConfigValue) => void;
  channels: DiscordChannel[];
  bosses: string[];
  boardStyles?: LootboardStyle[];
  locked?: boolean;
  groupId: number;
}) {
  const disabled = locked;
  return (
    <label className={`block ${disabled ? "opacity-60" : ""}`}>
      <span className="block text-sm font-medium">
        {field.label}
        {locked ? <span className="text-osrs-parchment-dark/50 ml-1 text-xs">🔒 Premium</span> : null}
      </span>
      <span className="text-osrs-parchment-dark/60 mb-1 block text-xs">{field.help}</span>
      {locked ? <LockedFieldHint groupId={groupId} /> : null}
      {field.type === "select" ? (
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${fieldInputClass} w-full disabled:cursor-not-allowed`}
        >
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.type === "text" ? (
        <textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${fieldInputClass} w-full disabled:cursor-not-allowed`}
          rows={2}
        />
      ) : field.type === "int" ? (
        <input
          type="number"
          min={field.min}
          max={field.max}
          value={value == null ? "" : Number(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          disabled={disabled}
          className={`${fieldInputClass} w-full disabled:cursor-not-allowed`}
        />
      ) : field.type === "channel" ? (
        <DiscordChannelPicker
          channels={channels}
          value={String(value ?? "")}
          onChange={(v) => onChange(v)}
          disabled={disabled}
        />
      ) : field.type === "bosslist" ? (
        <BossListPicker
          bosses={bosses}
          value={String(value ?? "")}
          onChange={(v) => onChange(v)}
          disabled={disabled}
        />
      ) : field.type === "boardstyle" ? (
        <BoardStylePicker
          styles={boardStyles}
          value={String(value ?? "")}
          onChange={(v) => onChange(v)}
          disabled={disabled}
        />
      ) : field.type === "password" ? (
        <PasswordInput
          value={String(value ?? "")}
          onChange={(v) => onChange(v)}
          disabled={disabled}
        />
      ) : (
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${fieldInputClass} w-full disabled:cursor-not-allowed`}
          placeholder={field.type === "csv" ? "comma,separated" : ""}
        />
      )}
    </label>
  );
}

/** Masked input for secret config values (e.g. the WOM verification code),
 * with a reveal toggle. Autocomplete is disabled so browsers don't offer to
 * save it as a login password. */
function PasswordInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="relative">
      <input
        type={revealed ? "text" : "password"}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${fieldInputClass} w-full pr-16 disabled:cursor-not-allowed`}
      />
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        disabled={disabled}
        className="text-osrs-parchment-dark/60 hover:text-osrs-parchment-dark absolute inset-y-0 right-2 my-auto text-xs disabled:cursor-not-allowed"
        aria-label={revealed ? "Hide value" : "Show value"}
      >
        {revealed ? "Hide" : "Show"}
      </button>
    </div>
  );
}

function LockedFieldHint({ groupId }: { groupId: number }) {
  return (
    <a
      href={`/groups/${groupId}/subscription`}
      className="text-osrs-gold-bright mt-1 block text-xs hover:underline"
    >
      Upgrade subscription to unlock →
    </a>
  );
}
