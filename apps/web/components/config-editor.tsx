"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CONFIG_CATEGORIES,
  GROUP_CONFIG_FIELDS,
  comingSoonNote,
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
import { getErrorMessage, isStaleDeploymentError, STALE_DEPLOYMENT_MESSAGE } from "@/lib/errors";
import { hasEntitlement } from "@/lib/entitlements";
import { collidingVoiceCounterChannel } from "@/lib/voice-counter";
import { viewerZone } from "@/components/local-time";
import { Alert, Badge, Button, Card, controlClass, Input, Select, Textarea } from "@/components/ui";
import { GpInput } from "@/components/gp-input";
import { ChannelListDelayHint, DiscordChannelPicker } from "@/components/discord-channel-picker";
import { BossListPicker } from "@/components/boss-list-picker";
import { BoardStylePicker } from "@/components/board-style-picker";
import { DeathMessageListEditor } from "@/components/death-message-list-editor";
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

/* --- Unsaved-edit stash (deploy-skew recovery) -------------------------------
   Admins routinely stage dozens of config edits before pressing Save. If a
   deploy lands in that window the Server Action id goes stale (see
   lib/errors.isStaleDeploymentError) and the only cure is a reload — which,
   unaided, throws the whole batch away. So on that specific failure we park the
   pending patch in sessionStorage (per-tab, dies with the tab) and re-apply it
   after the reload. Written only on that failure, never on every keystroke: a
   draft resurfacing after an ordinary reload would be its own surprise. */
const draftKey = (groupId: number) => `dt:config-draft:${groupId}`;

/** Read and consume this tab's stashed patch, if any. */
function takeDraft(groupId: number): ConfigMap | null {
  try {
    const raw = sessionStorage.getItem(draftKey(groupId));
    if (!raw) return null;
    sessionStorage.removeItem(draftKey(groupId));
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as ConfigMap;
  } catch {
    // Storage disabled/full, or a malformed entry — recover as if there were none.
    return null;
  }
}

/** Stash a patch for the post-reload restore. False when storage is unavailable. */
function stashDraft(groupId: number, patch: ConfigMap): boolean {
  try {
    sessionStorage.setItem(draftKey(groupId), JSON.stringify(patch));
    return true;
  } catch {
    return false;
  }
}

function clearDraft(groupId: number) {
  try {
    sessionStorage.removeItem(draftKey(groupId));
  } catch {
    /* nothing to clear if storage is unavailable */
  }
}

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
  /* Set when a save failed purely because this tab predates the running build.
     Retrying can only fail again, so the form pivots to offering a reload. */
  const [staleDeploy, setStaleDeploy] = useState(false);
  /* How many edits were carried across that reload, for the confirmation notice. */
  const [restoredCount, setRestoredCount] = useState(0);

  // Re-apply edits stashed by a deploy-skew failure before the reload. Merged
  // over `values` and not `baseline`, so they read as unsaved changes exactly
  // as they did pre-reload — and any key the server meanwhile already agrees
  // with simply drops out of `changed`.
  useEffect(() => {
    const draft = takeDraft(groupId);
    if (!draft) return;
    setValues((v) => ({ ...v, ...draft }));
    setRestoredCount(Object.keys(draft).length);
  }, [groupId]);

  /* Seed the clan's recap timezone from the first admin to open this page, so
     "post at hour 0" means their midnight instead of UTC's. Written once and
     only when unset: a second admin in another country must not move an already
     configured clan's post time out from under the first. Saved directly rather
     than dropped into the form, so it can't surprise an admin by riding along
     with an unrelated edit — and silently ignored on failure, since the sender
     treats an empty zone as UTC. */
  useEffect(() => {
    if (values.recap_timezone) return;
    const detected = viewerZone();
    if (!detected) return;
    setBaseline((b) => ({ ...b, recap_timezone: detected }));
    setValues((v) => (v.recap_timezone ? v : { ...v, recap_timezone: detected }));
    saveGroupConfig(groupId, { recap_timezone: detected }).catch(() => {});
    // Once per mount: `values` is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

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

  /* Both voice counters aimed at one channel: the bot's member-count loop runs
     after its loot loop, so it overwrites the loot name every ten minutes and
     the channel shows nothing but the member count. Silent — no error, and
     Discord logs no audit entry for a rename that changes nothing. Derived from
     the unsaved `values` so the warning appears as the second picker lands on
     the first's channel, not after a save. */
  const voiceCounterCollision = useMemo(
    () =>
      collidingVoiceCounterChannel(
        values.vc_to_display_monthly_loot,
        values.vc_to_display_droptracker_users,
      ),
    [values],
  );

  const set = (key: string, v: ConfigValue) => setValues((s) => ({ ...s, [key]: v }));

  const onReset = () => {
    setValues(baseline);
    setError(null);
    setStaleDeploy(false);
    setRestoredCount(0);
    clearDraft(groupId);
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
        setRestoredCount(0);
        clearDraft(groupId);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        if (isStaleDeploymentError(err)) {
          // Nothing reached the backend — park the batch and send them to a reload.
          const kept = stashDraft(groupId, changed);
          setStaleDeploy(true);
          setError(
            kept
              ? `${STALE_DEPLOYMENT_MESSAGE} Your ${dirtyCount} unsaved change${dirtyCount === 1 ? "" : "s"} will be restored automatically.`
              : STALE_DEPLOYMENT_MESSAGE,
          );
          return;
        }
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
              (f) => !["boolean", "text", "csv", "bosslist", "messagelist"].includes(f.type),
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
          const compact = fields.filter(
            (f) => !["boolean", "text", "csv", "bosslist", "messagelist"].includes(f.type),
          );
          const wide = fields.filter((f) => ["text", "csv", "bosslist", "messagelist"].includes(f.type));

          return (
            <Card key={cat.id} id={sectionId(cat.id)} padding="p-6" className="scroll-mt-24">
              <h2 className="text-osrs-gold mb-4 text-lg font-semibold">{cat.label}</h2>
              {cat.id === "pbs" && <HallOfFameBotCallout />}
              {cat.id === "integration" && voiceCounterCollision && (
                <VoiceCounterCollisionCallout
                  channelId={voiceCounterCollision}
                  channelName={channels.find((c) => c.id === voiceCounterCollision)?.name ?? null}
                />
              )}
              {fields.some((f) => f.type === "channel") && (
                <ChannelListDelayHint className={cat.id === "pbs" ? "mb-4" : "-mt-3 mb-4"} />
              )}

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
                      // Unsaved checkbox state, so the death-message preview
                      // flips placement instantly with the toggle below it.
                      deathAsEmbed={Boolean(values["death_message_as_embed_description"] ?? false)}
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
          {restoredCount > 0 && (
            <Alert variant="info">
              Restored {restoredCount} unsaved change{restoredCount === 1 ? "" : "s"} from before the site updated —
              review them and save.
            </Alert>
          )}
          {error && (
            <Alert variant="error">
              {error}
              {staleDeploy && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="bg-osrs-red/20 hover:bg-osrs-red/30 ml-2 rounded px-2 py-0.5 font-medium underline underline-offset-2"
                >
                  Reload now
                </button>
              )}
            </Alert>
          )}
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              variant="secondary"
              // Once the build has moved on, another Save can only fail the same
              // way — the reload above is the only path forward.
              disabled={!dirtyCount || pending || staleDeploy}
              className="rounded-lg"
            >
              {pending ? "Saving…" : `Save ${dirtyCount || ""} change${dirtyCount === 1 ? "" : "s"}`.trim()}
            </Button>
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
  const pendingNote = comingSoonNote(field);
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
          {pendingNote ? <ComingSoonBadge /> : null}
        </span>
        <span className="text-osrs-parchment-dark/60 mt-0.5 block text-xs">{field.help}</span>
        {pendingNote ? <ComingSoonHint note={pendingNote} /> : null}
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
  deathAsEmbed = false,
}: {
  field: ConfigField;
  value: ConfigValue;
  onChange: (v: ConfigValue) => void;
  channels: DiscordChannel[];
  bosses: string[];
  boardStyles?: LootboardStyle[];
  locked?: boolean;
  groupId: number;
  deathAsEmbed?: boolean;
}) {
  const disabled = locked;
  const pendingNote = comingSoonNote(field);
  return (
    <label className={`block ${disabled ? "opacity-60" : ""}`}>
      <span className="block text-sm font-medium">
        {field.label}
        {locked ? <span className="text-osrs-parchment-dark/50 ml-1 text-xs">🔒 Premium</span> : null}
        {pendingNote ? <ComingSoonBadge /> : null}
      </span>
      <span className="text-osrs-parchment-dark/60 mb-1 block text-xs">{field.help}</span>
      {pendingNote ? <ComingSoonHint note={pendingNote} /> : null}
      {locked ? <LockedFieldHint groupId={groupId} /> : null}
      {field.type === "select" ? (
        <Select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full disabled:cursor-not-allowed"
        >
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : field.type === "text" ? (
        <Textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full disabled:cursor-not-allowed"
          rows={2}
        />
      ) : field.type === "int" && field.unit ? (
        // Amounts with six-plus zeros in them: typed as shorthand, shown back
        // resolved. `emptyAs` is the field's own floor, so clearing the box
        // means "no threshold" rather than sending a null the backend rejects.
        <GpInput
          min={field.min}
          max={field.max}
          value={Number(value ?? field.default ?? 0)}
          emptyAs={field.min ?? 0}
          unit={field.unit}
          hint={`Empty saves as ${field.min ?? 0}`}
          onChange={onChange}
          disabled={disabled}
          className={controlClass("md", "default", "w-full disabled:cursor-not-allowed")}
        />
      ) : field.type === "int" ? (
        <Input
          type="number"
          min={field.min}
          max={field.max}
          value={value == null ? "" : Number(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          disabled={disabled}
          className="w-full disabled:cursor-not-allowed"
        />
      ) : field.type === "channel" ? (
        <DiscordChannelPicker
          channels={channels}
          value={String(value ?? "")}
          onChange={(v) => onChange(v)}
          disabled={disabled}
          // The vc_to_display_* stat displays want a voice channel; everything
          // else wants somewhere postable.
          mode={field.channelKind === "voice" ? "voice" : "sendable"}
        />
      ) : field.type === "bosslist" ? (
        <BossListPicker
          bosses={bosses}
          value={String(value ?? "")}
          onChange={(v) => onChange(v)}
          disabled={disabled}
        />
      ) : field.type === "messagelist" ? (
        <DeathMessageListEditor
          value={String(value ?? "")}
          onChange={(v) => onChange(v)}
          asEmbedDescription={deathAsEmbed}
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
          name={field.key}
          value={String(value ?? "")}
          onChange={(v) => onChange(v)}
          disabled={disabled}
        />
      ) : (
        <Input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          maxLength={field.maxLength}
          className="w-full disabled:cursor-not-allowed"
          placeholder={field.type === "csv" ? "comma,separated" : ""}
        />
      )}
      {field.templateTokens ? (
        <TemplatePreview tokens={field.templateTokens} template={String(value ?? "")} fallback={String(field.default ?? "")} />
      ) : null}
    </label>
  );
}

/** Live preview of a name template, plus a warning when the value token is missing.
 *
 * Mirrors `render_channel_name` in the bot's `services/channel_name_render.py`:
 * blank template falls back to the default, tokens substitute, and a template
 * with no required token gets the value APPENDED rather than dropped. Keep the
 * two in step — the whole point is that what an admin sees here is what the
 * channel is named ten minutes later.
 */
function TemplatePreview({
  tokens,
  template,
  fallback,
}: {
  tokens: NonNullable<ConfigField["templateTokens"]>;
  template: string;
  fallback: string;
}) {
  const source = template.trim() === "" ? fallback : template;
  const missing = tokens.filter((t) => t.required && !source.includes(t.token));
  let rendered = source;
  for (const t of tokens) rendered = rendered.split(t.token).join(t.sample);
  for (const t of missing) rendered = `${rendered.trimEnd()} ${t.sample}`.trim();
  rendered = rendered.slice(0, 100);

  return (
    <div className="mt-1 space-y-1">
      <div className="text-osrs-parchment-dark/60 text-xs">
        Preview: <span className="text-osrs-gold-bright font-mono">{rendered || "\u00a0"}</span>
      </div>
      {missing.length > 0 ? (
        <div className="text-osrs-parchment-dark/70 text-xs">
          <span className="text-osrs-gold-bright">Heads up:</span> your template has no{" "}
          {missing.map((t) => (
            <code key={t.token} className="font-mono">
              {t.token}
            </code>
          ))}
          , so the number is added on the end. Put the placeholder where you want it to control the position.
        </div>
      ) : null}
    </div>
  );
}

/** Masked input for secret config values (e.g. the WOM verification code),
 * with a reveal toggle. `autoComplete="off"` is not honored by Chrome/Safari
 * on type="password" inputs (they autofill saved site passwords into any
 * password field regardless), so we use `autoComplete="new-password"`
 * instead — the one value browsers actually respect for "don't offer a
 * saved credential here", since these values aren't login passwords. */
function PasswordInput({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="relative">
      <Input
        type={revealed ? "text" : "password"}
        autoComplete="new-password"
        // A per-field name (not "password"/"code") keeps autofill heuristics,
        // which sniff the name as well as the type, from treating this as a
        // login field. Unique per key, so two secret fields never collide.
        name={`dt-cfg-${name}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full pr-16 disabled:cursor-not-allowed"
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

/**
 * The Hall of Fame used to be posted by its own Discord application, so groups
 * had to invite a second bot and kept enabling these settings while nothing
 * posted. The main bot now runs the Hall of Fame itself, and a group moves
 * across by REMOVING the old bot: services/hall_of_fame.py notices it is gone,
 * deletes the boards it left behind and takes the channel over permanently.
 * That is why this tells people to kick a bot rather than invite one — and why
 * the old invite link is gone.
 */
function HallOfFameBotCallout() {
  return (
    <div className="border-osrs-gold/30 bg-osrs-brown-dark/40 mb-4 rounded-lg border p-4">
      <p className="text-osrs-gold-bright text-sm font-medium">
        Still have the old Hall of Fame bot? You can remove it
      </p>
      <p className="text-osrs-parchment-dark/80 mt-1 text-xs leading-relaxed">
        The main DropTracker bot now posts Hall of Fame leaderboards itself. If{" "}
        <strong>DropTracker Hall of Fame</strong> (the separate bot) is still in your server, kick
        it — the main bot will clean up the messages it left behind and rebuild the board within
        about 10 minutes. No invite, and no second bot, is needed any more.
      </p>
      <p className="text-osrs-parchment-dark/80 mt-2 text-xs leading-relaxed">
        The main bot needs <strong>View Channel</strong>, <strong>Send Messages</strong>,{" "}
        <strong>Embed Links</strong> and <strong>Read Message History</strong> in the Hall of Fame
        channel you pick below. Granting it <strong>Manage Messages</strong> as well lets it delete
        the retired bot&apos;s old leaderboards for you; without that they stay until someone
        removes them by hand. If the channel is private, add the bot (or its role) to the
        channel&apos;s permissions.
      </p>
      <p className="text-osrs-parchment-dark/60 mt-2 text-xs">
        Never had the separate bot? Nothing to do — leaderboards are rebuilt automatically and can
        take up to ~10 minutes to first appear.
      </p>
    </div>
  );
}

/** Shown when both voice counters resolve to the same channel.
 *
 * Not a save-blocker: the pair is only broken once both are set, and an admin
 * mid-edit (having picked the channel for one counter and not yet moved the
 * other) shouldn't be locked out of saving the rest of the page. It explains
 * the fix — a second voice channel — because "it stopped working" is how this
 * reaches support otherwise. */
function VoiceCounterCollisionCallout({
  channelId,
  channelName,
}: {
  channelId: string;
  channelName: string | null;
}) {
  return (
    <div className="border-osrs-red/40 bg-osrs-red/10 mb-4 rounded-lg border p-4">
      <p className="text-osrs-red text-sm font-medium">
        Both voice counters point at the same channel
      </p>
      <p className="text-osrs-parchment-dark/80 mt-1 text-xs leading-relaxed">
        <strong>Monthly loot voice channel</strong> and <strong>Member count voice channel</strong>{" "}
        are both set to{" "}
        <code className="font-mono">{channelName ? `#${channelName}` : channelId}</code>. A channel
        can only have one name, and the member count is written last — so that channel will show
        the member count and your <strong>monthly loot total will never appear</strong>.
      </p>
      <p className="text-osrs-parchment-dark/80 mt-2 text-xs leading-relaxed">
        Make a second voice channel and point one counter at each, or clear whichever of the two
        you don&apos;t want. Leaving them as they are is not an error the bot can report — the loot
        name is simply overwritten every ten minutes.
      </p>
    </div>
  );
}

/* --- "Coming soon" fields ----------------------------------------------------
   Settings routinely ship here before the RuneLite plugin update that actually
   feeds them clears the Plugin Hub. Left unmarked, that gap reads as a bug —
   admins turn the setting on, see nothing happen, and open a ticket. So a field
   flagged `comingSoon` in the registry wears a badge and states what it is
   waiting on, while staying editable: configure it once now, and it starts
   working when the release lands. */

function ComingSoonBadge() {
  return (
    <Badge variant="sky" className="ml-2 align-middle" title="Not live yet">
      <span aria-hidden>⏳</span>
      Coming soon
    </Badge>
  );
}

function ComingSoonHint({ note }: { note: string }) {
  return <span className="mt-1 block text-xs text-sky-400/90">{note}</span>;
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
