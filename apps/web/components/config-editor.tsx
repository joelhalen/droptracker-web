"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import {
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
import {
  SEASONAL_FIELDS,
  blockLayout,
  fieldBlocks,
  navGroups,
  seasonalKey,
  sectionAnchor,
  sectionForKey,
  visibleSections,
  type SettingsInsertId,
  type SettingsPanelId,
  type SettingsSectionId,
  type VisibleSection,
} from "@/lib/group-settings-sections";
import { collidingVoiceCounterChannel } from "@/lib/voice-counter";
import { viewerZone } from "@/components/local-time";
import { Alert, Badge, Button, Card, controlClass, EmptyState, Input, Select, Textarea } from "@/components/ui";
import { GpInput } from "@/components/gp-input";
import { ChannelListDelayHint, DiscordChannelPicker } from "@/components/discord-channel-picker";
import { BossListPicker } from "@/components/boss-list-picker";
import { MultiSelectOptions } from "@/components/multi-select-options";
import { BoardStylePicker } from "@/components/board-style-picker";
import { DeathMessageListEditor } from "@/components/death-message-list-editor";
import { SettingsBlock, SettingsSectionShell, SettingsSubheading } from "@/components/settings-section";
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

function scrollToSection(id: SettingsSectionId) {
  document.getElementById(sectionAnchor(id))?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Editors on the settings page that aren't config keys, already bound to
 * their data by the page. The two panels are sections of their own; the
 * inserts render inside a registry section (lib/group-settings-sections.ts
 * says which). They save themselves — nothing here goes through Save.
 */
export type ConfigEditorExtras = Record<SettingsPanelId | SettingsInsertId, ReactNode>;

/**
 * The group settings page: one column of sections with a grouped sidebar, a
 * filter box, a scroll-spy and one Save for every registry field. Not a
 * `<form>` — the list editors and the timeframe board nest inside it with
 * their own inputs, and an Enter in one of those must never save eighty
 * unrelated settings. Save is the button, nothing else.
 */
export function ConfigEditor({
  groupId,
  initial,
  subscription = null,
  tiers: _tiers = [],
  isSuperadmin = false,
  seasonalActive = true,
  extras,
}: {
  groupId: number;
  initial: ConfigMap;
  subscription?: GroupSubscription | null;
  tiers?: SubscriptionTier[];
  isSuperadmin?: boolean;
  /** Global seasonal-processing switch state (from GET /seasonal-status). */
  seasonalActive?: boolean;
  extras: ConfigEditorExtras;
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

  /* The filter box narrows the page to matching settings — sections and
     fields alike. Purely a view: hidden fields keep their values and still
     count as unsaved changes, so narrowing to one setting, editing it and
     pressing Save behaves exactly like scrolling to it would. */
  const [filter, setFilter] = useState("");
  const sections = useMemo(() => visibleSections(filter), [filter]);
  const groups = useMemo(() => navGroups(sections), [sections]);

  // Scroll-spy: highlight whichever section is currently in view.
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(
    sections[0]?.section.id ?? "profile",
  );
  useEffect(() => {
    // The observer only reports sections whose intersection CHANGED, so keep
    // the full set that is inside the band and re-pick the topmost of all of
    // them every time. Picking from the changed entries alone left the old
    // highlight in place whenever a section merely scrolled out of the band.
    const inBand = new Map<string, Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) inBand.set(e.target.id, e.target);
          else inBand.delete(e.target.id);
        }
        let topMost: Element | null = null;
        let topMostY = Infinity;
        for (const el of inBand.values()) {
          const y = el.getBoundingClientRect().top;
          if (y < topMostY) {
            topMostY = y;
            topMost = el;
          }
        }
        if (topMost) setActiveSection(topMost.id.replace(/^cfg-/, "") as SettingsSectionId);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );
    for (const s of sections) {
      const el = document.getElementById(sectionAnchor(s.section.id));
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

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
  const changedBySection = useMemo(() => {
    const counts: Partial<Record<SettingsSectionId, number>> = {};
    for (const key of Object.keys(changed)) {
      const field = getConfigField(key);
      if (!field) continue;
      const id = sectionForKey(key, field);
      counts[id] = (counts[id] ?? 0) + 1;
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

  const onSave = () => {
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

  /** Callouts that belong above one block of one section. */
  const calloutFor = (sectionId: SettingsSectionId, group: string | null): ReactNode => {
    if (sectionId === "pbs" && group === "Hall of Fame") return <HallOfFameBotCallout />;
    if (sectionId === "voice" && group === null && voiceCounterCollision) {
      return (
        <VoiceCounterCollisionCallout
          channelId={voiceCounterCollision}
          channelName={channels.find((c) => c.id === voiceCounterCollision)?.name ?? null}
        />
      );
    }
    return null;
  };

  const filterBox = (
    <Input
      type="search"
      value={filter}
      onChange={(e) => setFilter(e.target.value)}
      placeholder="Find a setting…"
      aria-label="Find a setting"
      className="w-full"
    />
  );

  const renderFields = (
    sectionId: SettingsSectionId,
    fields: ConfigField[],
    keyFor: (field: ConfigField) => string,
    startIndex: number,
  ) =>
    fieldBlocks(fields).map((block, i) => (
      <SettingsBlock key={block.group ?? "_"} first={startIndex + i === 0}>
        {block.group && <SettingsSubheading>{block.group}</SettingsSubheading>}
        {calloutFor(sectionId, block.group)}
        <FieldGrid
          fields={block.fields}
          keyFor={keyFor}
          values={values}
          set={set}
          channels={channels}
          bosses={bosses}
          boardStyles={boardStyles}
          isFieldLocked={isFieldLocked}
          groupId={groupId}
        />
      </SettingsBlock>
    ));

  const renderSection = ({ section, fields, inserts }: VisibleSection) => {
    const id = sectionAnchor(section.id);
    const count = changedBySection[section.id];
    const badge = count ? <UnsavedBadge count={count} /> : null;

    if (section.kind === "panel") {
      return (
        <SettingsSectionShell key={section.id} id={id} label={section.label} blurb={section.blurb}>
          {extras[section.id as SettingsPanelId]}
        </SettingsSectionShell>
      );
    }

    if (section.kind === "seasonal") {
      return (
        <SettingsSectionShell key={section.id} id={id} label={section.label} blurb={section.blurb} badge={badge}>
          {!seasonalActive && (
            <div className="mb-4">
              <Alert variant="info">
                Seasonal processing is currently disabled globally — these settings will take
                effect again when the next seasonal game mode goes live.
              </Alert>
            </div>
          )}
          {renderFields(section.id, fields, (f) => seasonalKey(f.key), 0)}
        </SettingsSectionShell>
      );
    }

    // Registry section: its inserts around its field blocks, in one stack of
    // hairline-separated blocks so an insert reads as part of the section.
    const top = inserts.filter((i) => i.position === "top");
    const bottom = inserts.filter((i) => i.position === "bottom");
    const blockCount = fieldBlocks(fields).length;
    return (
      <SettingsSectionShell key={section.id} id={id} label={section.label} blurb={section.blurb} badge={badge}>
        {/* Once, where the routing lives — nine sections carry a channel
            picker now, and every picker already offers manual id entry. */}
        {section.id === "channels" && <ChannelListDelayHint className="mb-4" />}
        {top.map((insert, i) => (
          <SettingsBlock key={insert.id} first={i === 0}>
            {extras[insert.id]}
          </SettingsBlock>
        ))}
        {renderFields(section.id, fields, (f) => f.key, top.length)}
        {bottom.map((insert, i) => (
          <SettingsBlock key={insert.id} first={top.length + blockCount + i === 0}>
            {extras[insert.id]}
          </SettingsBlock>
        ))}
      </SettingsSectionShell>
    );
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[14rem_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-4">
          {filterBox}
          <nav className="space-y-3 text-sm" aria-label="Settings sections">
            {groups.map((group) => (
              <div key={group.nav}>
                <div className="text-osrs-parchment-dark/50 mb-1 px-3 text-[10px] font-semibold tracking-wide uppercase">
                  {group.nav}
                </div>
                <div className="space-y-0.5">
                  {group.sections.map(({ section }) => {
                    const active = activeSection === section.id;
                    const count = changedBySection[section.id];
                    return (
                      <a
                        key={section.id}
                        href={`#${sectionAnchor(section.id)}`}
                        aria-current={active ? "location" : undefined}
                        onClick={(e) => {
                          e.preventDefault();
                          scrollToSection(section.id);
                        }}
                        className={`flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 transition-colors ${
                          active
                            ? "bg-osrs-bronze text-osrs-parchment"
                            : "text-osrs-parchment-dark/80 hover:bg-osrs-surface-2"
                        }`}
                      >
                        <span className="truncate">{section.label}</span>
                        {count ? <UnsavedBadge count={count} /> : null}
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      <div className="min-w-0 space-y-6 pb-24">
        <div className="lg:hidden">{filterBox}</div>

        {sections.length === 0 && (
          <Card padding="p-6">
            <EmptyState
              title={`No settings match “${filter.trim()}”`}
              hint="Try another word — settings match on their name, description and section."
            />
            <div className="mt-3 text-center">
              <Button variant="secondary" size="sm" onClick={() => setFilter("")}>
                Clear filter
              </Button>
            </div>
          </Card>
        )}

        {sections.map(renderSection)}

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
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onSave}
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
            {/* No sidebar below lg: the jump menu rides in the bar that is
                always on screen instead. */}
            <div className="ml-auto lg:hidden">
              <Select
                value=""
                aria-label="Jump to section"
                onChange={(e) => {
                  if (e.target.value) scrollToSection(e.target.value as SettingsSectionId);
                }}
                className="max-w-[12rem]"
              >
                <option value="">Jump to…</option>
                {groups.map((group) => (
                  <optgroup key={group.nav} label={group.nav}>
                    {group.sections.map(({ section }) => {
                      const count = changedBySection[section.id];
                      return (
                        <option key={section.id} value={section.id}>
                          {section.label}
                          {count ? ` (${count})` : ""}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UnsavedBadge({ count }: { count: number }) {
  return (
    <span
      className="bg-osrs-gold text-osrs-brown-dark rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
      title={`${count} unsaved change${count === 1 ? "" : "s"}`}
    >
      {count}
    </span>
  );
}

/**
 * One block of fields. Toggles sit two to a row, inputs two to a row, wide
 * inputs (textarea, lists, the message editor) on a row of their own. A block
 * whose first field is a toggle — usually a master "Notify X" switch — shows
 * its toggles first so the switch reads as the heading of what follows;
 * otherwise inputs come first (Drop notifications opens on the minimum value).
 */
function FieldGrid({
  fields,
  keyFor,
  values,
  set,
  channels,
  bosses,
  boardStyles,
  isFieldLocked,
  groupId,
}: {
  fields: ConfigField[];
  keyFor: (field: ConfigField) => string;
  values: ConfigMap;
  set: (key: string, v: ConfigValue) => void;
  channels: DiscordChannel[];
  bosses: string[];
  boardStyles: LootboardStyle[];
  isFieldLocked: (field: ConfigField) => boolean;
  groupId: number;
}) {
  const { leadWithToggles, toggles, compact, wide } = blockLayout(fields);
  const hasInputs = compact.length > 0 || wide.length > 0;
  const divider = "border-osrs-bronze/20 mt-5 border-t pt-5";

  const inputs = hasInputs ? (
    <div className={leadWithToggles && toggles.length > 0 ? divider : ""}>
      {compact.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {compact.map((f) => (
            <InputField
              key={keyFor(f)}
              field={f}
              value={values[keyFor(f)] ?? f.default}
              onChange={(v) => set(keyFor(f), v)}
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
              key={keyFor(f)}
              field={f}
              value={values[keyFor(f)] ?? f.default}
              onChange={(v) => set(keyFor(f), v)}
              channels={channels}
              bosses={bosses}
              boardStyles={boardStyles}
              locked={isFieldLocked(f)}
              groupId={groupId}
              // Unsaved checkbox state, so the death-message preview flips
              // placement instantly with its toggle.
              deathAsEmbed={Boolean(values["death_message_as_embed_description"] ?? false)}
            />
          ))}
        </div>
      )}
    </div>
  ) : null;

  const switches =
    toggles.length > 0 ? (
      <div className={`grid gap-3 sm:grid-cols-2 ${!leadWithToggles && hasInputs ? divider : ""}`}>
        {toggles.map((f) => (
          <ToggleField
            key={keyFor(f)}
            field={f}
            value={Boolean(values[keyFor(f)] ?? f.default)}
            onChange={(v) => set(keyFor(f), v)}
            locked={isFieldLocked(f)}
            groupId={groupId}
          />
        ))}
      </div>
    ) : null;

  return leadWithToggles ? (
    <>
      {switches}
      {inputs}
    </>
  ) : (
    <>
      {inputs}
      {switches}
    </>
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
  // A checkbox list labels each of its own boxes, and labels can't nest.
  const Wrapper = field.type === "multiselect" ? "div" : "label";
  return (
    <Wrapper className={`block ${disabled ? "opacity-60" : ""}`}>
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
      ) : field.type === "multiselect" ? (
        <MultiSelectOptions
          field={field}
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
    </Wrapper>
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
