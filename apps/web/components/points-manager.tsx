"use client";

/**
 * Group custom-points management (XF addon parity, rebuilt):
 * base award rules per submission type, behavior settings (sharing/splits/
 * caps/visibility), per-item/NPC overrides, include-exclude lists, timed
 * boosts, leaderboard seasons, manual adjustments with audit trail, award
 * history, and a danger-zone full reset.
 *
 * All mutations go through server actions in
 * `app/(admin)/groups/[id]/points/actions.ts`; the backend enforces the
 * `custom_points` entitlement on every write.
 */

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import type {
  PointBoost,
  PointListEntry,
  PointListType,
  PointMod,
  PointsBehavior,
  PointSeason,
  PointsHistoryPage,
  PointsSettings,
  PointRule,
} from "@droptracker/api-types";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Card, EmptyState } from "@/components/ui";
import { NameSearch } from "@/components/event-task-form";
import {
  addPointBoost,
  addPointListEntry,
  addPointMod,
  addPointSeason,
  adjustPoints,
  editPointMod,
  loadPointsHistory,
  removePointBoost,
  removePointListEntry,
  removePointMod,
  removePointSeason,
  resetGroupPoints,
  savePointsSettings,
  searchPointItems,
  searchPointNpcs,
  searchPointPlayers,
} from "@/app/(site)/(admin)/groups/[id]/points/manage/actions";

const field =
  "bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-osrs-gold/60";

const REASON_LABELS: Record<string, string> = {
  drop: "Drops",
  pb: "Personal bests",
  pet: "New pets",
  clog: "Collection log slots",
  easy_ca: "Easy combat achievements",
  medium_ca: "Medium combat achievements",
  hard_ca: "Hard combat achievements",
  elite_ca: "Elite combat achievements",
  master_ca: "Master combat achievements",
  grandmaster_ca: "Grandmaster combat achievements",
};

const EVENT_TYPE_OPTIONS = [
  { value: "any", label: "Any submission type" },
  { value: "drop", label: "Drops" },
  { value: "pb", label: "Personal bests" },
  { value: "pet", label: "Pets" },
  { value: "clog", label: "Collection log" },
];

const LIST_TYPE_HELP: Record<PointListType, string> = {
  blacklist: "Matching submissions never award points.",
  whitelist: "When any whitelist entries exist, ONLY matching submissions award points.",
  no_split: "Matching submissions award only the receiver — never split to teammates.",
};

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h2 className="text-osrs-gold text-lg font-semibold">{title}</h2>
      {hint && <p className="text-osrs-parchment-dark/70 mt-0.5 text-sm">{hint}</p>}
    </div>
  );
}

/** How many rows the paginated overrides table / list columns show per page. */
const PAGE_SIZE = 10;
const LIST_PAGE_SIZE = 6;

/** Does an item/NPC target (override or list entry) match a lowercased query? */
function targetMatches(
  q: string,
  t: {
    item_name?: string | null;
    npc_name?: string | null;
    item_id?: number | null;
    npc_id?: number | null;
    description?: string | null;
  },
): boolean {
  return [
    t.item_name,
    t.npc_name,
    t.description,
    t.item_id ? `#${t.item_id}` : null,
    t.npc_id ? `#${t.npc_id}` : null,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

/** Compact search box (magnifier + clear) that filters a section in real time. */
function SearchInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 0 24 24"
        className="text-osrs-parchment-dark/40 pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 focus:ring-osrs-gold/60 w-full rounded border py-2 pl-8 pr-8 text-sm focus:outline-none focus:ring-1"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="text-osrs-parchment-dark/50 hover:text-osrs-gold absolute right-2 top-1/2 -translate-y-1/2"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/** Prev/next pager (award-history style) with a result-count summary. */
function Pager({
  page,
  totalPages,
  onPage,
  summary,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  summary: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-osrs-parchment-dark/50 text-xs">{summary}</span>
      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            className="text-osrs-gold-bright disabled:text-osrs-parchment-dark/30 hover:underline"
          >
            ← Prev
          </button>
          <span className="text-osrs-parchment-dark/60">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page >= totalPages}
            className="text-osrs-gold-bright disabled:text-osrs-parchment-dark/30 hover:underline"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function TargetChip({
  itemName,
  npcName,
  itemId,
  npcId,
}: {
  itemName?: string | null;
  npcName?: string | null;
  itemId?: number | null;
  npcId?: number | null;
}) {
  const parts: string[] = [];
  if (itemName || itemId) parts.push(itemName ?? `Item #${itemId}`);
  if (npcName || npcId) parts.push(`from ${npcName ?? `NPC #${npcId}`}`);
  return <span>{parts.length ? parts.join(" ") : "Anything"}</span>;
}

/* -------------------------------------------------------------------------- */

export function PointsManager({
  groupId,
  initialSettings,
  initialMods,
  initialLists,
  initialBoosts,
  initialHistory,
}: {
  groupId: number;
  initialSettings: PointsSettings;
  initialMods: PointMod[];
  initialLists: PointListEntry[];
  initialBoosts: PointBoost[];
  initialHistory: PointsHistoryPage;
}) {
  const enabled = initialSettings.enabled;

  return (
    <div className="space-y-8">
      {!enabled && (
        <Alert variant="info">
          The custom points system requires a subscription tier that includes it. Your current
          configuration is shown below, but points are not being awarded and changes are locked.{" "}
          <Link
            href={`/groups/${groupId}/subscription` as Route}
            className="text-osrs-gold-bright font-medium hover:underline"
          >
            View subscription options →
          </Link>
        </Alert>
      )}

      <p className="text-osrs-parchment-dark/80 max-w-3xl text-sm">
        Award points to members automatically for drops, personal bests, pets, collection log
        slots and combat achievements — with per-item and per-boss overrides, timed boost events,
        and a points leaderboard.{" "}
        <Link
          href={`/groups/${groupId}/points/leaderboard` as Route}
          className="text-osrs-gold-bright font-medium hover:underline"
        >
          View the leaderboard →
        </Link>
      </p>

      <RulesSection groupId={groupId} initial={initialSettings.rules} disabled={!enabled} />
      <BehaviorSection groupId={groupId} initial={initialSettings.behavior} disabled={!enabled} />
      <ModsSection groupId={groupId} initial={initialMods} disabled={!enabled} />
      <ListsSection groupId={groupId} initial={initialLists} disabled={!enabled} />
      <BoostsSection groupId={groupId} initial={initialBoosts} disabled={!enabled} />
      <SeasonsSection groupId={groupId} initial={initialSettings.seasons} disabled={!enabled} />
      <AdjustSection groupId={groupId} disabled={!enabled} />
      <HistorySection groupId={groupId} initial={initialHistory} />
      <DangerSection groupId={groupId} />
    </div>
  );
}

/* --- Base rules ------------------------------------------------------------ */

function RulesSection({
  groupId,
  initial,
  disabled,
}: {
  groupId: number;
  initial: PointRule[];
  disabled: boolean;
}) {
  const [rules, setRules] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const setRule = (reason: string, patch: Partial<PointRule>) =>
    setRules((prev) => prev.map((r) => (r.reason === reason ? { ...r, ...patch } : r)));

  const save = () =>
    startTransition(async () => {
      setError(null);
      setSaved(false);
      try {
        const result = await savePointsSettings(groupId, {
          rules: rules.map((r) => ({ reason: r.reason, award: r.award, divisor: r.divisor })),
        });
        setRules(result.rules);
        setSaved(true);
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });

  return (
    <section className="space-y-3">
      <SectionHeading
        title="Award rules"
        hint="Base points per submission type. Drops award (GP value ÷ divisor) × award, rounded; everything else is a flat award. Set an award to 0 to disable that type."
      />
      <Card padding="p-0" className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-osrs-bronze/25 text-osrs-parchment-dark/60 border-b text-left text-xs uppercase">
              <th className="px-4 py-2.5">Submission type</th>
              <th className="px-4 py-2.5">Points awarded</th>
              <th className="px-4 py-2.5">GP divisor</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.reason} className="border-osrs-bronze/15 border-b last:border-0">
                <td className="px-4 py-2">
                  <div className="font-medium">{REASON_LABELS[r.reason] ?? r.reason}</div>
                  {r.description && (
                    <div className="text-osrs-parchment-dark/50 text-xs">{r.description}</div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min={0}
                    value={r.award}
                    disabled={disabled}
                    onChange={(e) => setRule(r.reason, { award: Number(e.target.value) })}
                    className={`${field} w-28`}
                  />
                </td>
                <td className="px-4 py-2">
                  {r.uses_divisor ? (
                    <input
                      type="number"
                      min={1}
                      value={r.divisor}
                      disabled={disabled}
                      onChange={(e) => setRule(r.reason, { divisor: Number(e.target.value) })}
                      className={`${field} w-36`}
                    />
                  ) : (
                    <span className="text-osrs-parchment-dark/40">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {error && <Alert variant="error">{error}</Alert>}
      {saved && <Alert variant="success">Award rules saved.</Alert>}
      <button
        type="button"
        onClick={save}
        disabled={disabled || pending}
        className="bg-osrs-gold/90 text-osrs-brown-dark rounded px-4 py-2 text-sm font-semibold hover:bg-osrs-gold disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save award rules"}
      </button>
    </section>
  );
}

/* --- Behavior --------------------------------------------------------------- */

function BehaviorSection({
  groupId,
  initial,
  disabled,
}: {
  groupId: number;
  initial: PointsBehavior;
  disabled: boolean;
}) {
  const [behavior, setBehavior] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof PointsBehavior>(key: K, value: PointsBehavior[K]) =>
    setBehavior((prev) => ({ ...prev, [key]: value }));

  const save = () =>
    startTransition(async () => {
      setError(null);
      setSaved(false);
      try {
        const result = await savePointsSettings(groupId, { behavior });
        setBehavior(result.behavior);
        setSaved(true);
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });

  const toggle = (key: keyof PointsBehavior, label: string, help: string) => (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={Boolean(behavior[key])}
        disabled={disabled}
        onChange={(e) => set(key, e.target.checked as never)}
        className="mt-1"
      />
      <span>
        <span className="text-osrs-parchment font-medium">{label}</span>
        <span className="text-osrs-parchment-dark/60 block text-xs">{help}</span>
      </span>
    </label>
  );

  return (
    <section className="space-y-3">
      <SectionHeading title="Behavior" hint="How points are calculated, shared and displayed." />
      <Card padding="p-4" className="space-y-4 text-sm">
        {toggle(
          "stacks_award_points",
          "Stacked drops pool their value",
          "On: a stack's full GP value is used for the divisor formula. Off: each item in the stack is valued separately (no remainder pooling).",
        )}
        {toggle(
          "point_sharing",
          "Share points with teammates",
          "Award points to other group members listed on a submission (e.g. raid teammates).",
        )}
        {behavior.point_sharing && (
          <label className="ml-7 flex items-center gap-3">
            <span className="text-osrs-parchment-dark/80">Sharing method</span>
            <select
              value={behavior.point_sharing_method}
              disabled={disabled}
              onChange={(e) => set("point_sharing_method", e.target.value as never)}
              className={field}
            >
              <option value="equal_split">Split equally between participants</option>
              <option value="award_all">Everyone gets the full award</option>
            </select>
          </label>
        )}
        {toggle(
          "points_require_group_only",
          "Group-only content",
          "Only award points for solo content, or group content that includes at least one other member of this group.",
        )}
        {toggle(
          "points_leaderboard_public",
          "Public leaderboard",
          "Anyone can view your points leaderboard. Off: only group members and admins can see it.",
        )}
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-3">
            <span className="text-osrs-parchment-dark/80">Minimum points per submission</span>
            <input
              type="number"
              min={0}
              value={behavior.min_submission_pts}
              disabled={disabled}
              onChange={(e) => set("min_submission_pts", Number(e.target.value))}
              className={`${field} w-28`}
            />
          </label>
          <label className="flex items-center gap-3">
            <span className="text-osrs-parchment-dark/80">Maximum points per submission</span>
            <input
              type="number"
              min={0}
              value={behavior.max_submission_pts}
              disabled={disabled}
              onChange={(e) => set("max_submission_pts", Number(e.target.value))}
              className={`${field} w-28`}
            />
          </label>
        </div>
        <p className="text-osrs-parchment-dark/50 text-xs">
          Bounds apply per player per submission; 0 disables a bound.
        </p>
      </Card>
      {error && <Alert variant="error">{error}</Alert>}
      {saved && <Alert variant="success">Behavior settings saved.</Alert>}
      <button
        type="button"
        onClick={save}
        disabled={disabled || pending}
        className="bg-osrs-gold/90 text-osrs-brown-dark rounded px-4 py-2 text-sm font-semibold hover:bg-osrs-gold disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save behavior"}
      </button>
    </section>
  );
}

/* --- Item/NPC overrides ------------------------------------------------------ */

type PickedTarget = { item?: { id: number; name: string }; npc?: { id: number; name: string } };

function TargetPicker({
  groupId,
  target,
  setTarget,
  disabled,
}: {
  groupId: number;
  target: PickedTarget;
  setTarget: (t: PickedTarget) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        {target.item ? (
          <button
            type="button"
            onClick={() => setTarget({ ...target, item: undefined })}
            className="border-osrs-bronze/40 text-osrs-parchment hover:border-osrs-gold/60 w-full rounded border px-3 py-2 text-left text-sm"
          >
            {target.item.name} <span className="text-osrs-parchment-dark/50">✕</span>
          </button>
        ) : (
          <NameSearch
            placeholder="Item (optional)…"
            iconBase="itemdb"
            disabled={disabled}
            search={(q) => searchPointItems(groupId, q)}
            onPick={(e) => setTarget({ ...target, item: { id: e.id, name: e.name } })}
          />
        )}
      </div>
      <div>
        {target.npc ? (
          <button
            type="button"
            onClick={() => setTarget({ ...target, npc: undefined })}
            className="border-osrs-bronze/40 text-osrs-parchment hover:border-osrs-gold/60 w-full rounded border px-3 py-2 text-left text-sm"
          >
            {target.npc.name} <span className="text-osrs-parchment-dark/50">✕</span>
          </button>
        ) : (
          <NameSearch
            placeholder="NPC / boss (optional)…"
            iconBase="npcdb"
            disabled={disabled}
            search={(q) => searchPointNpcs(groupId, q)}
            onPick={(e) => setTarget({ ...target, npc: { id: e.id, name: e.name } })}
          />
        )}
      </div>
    </div>
  );
}

function ModsSection({
  groupId,
  initial,
  disabled,
}: {
  groupId: number;
  initial: PointMod[];
  disabled: boolean;
}) {
  const [mods, setMods] = useState(initial);
  const [target, setTarget] = useState<PickedTarget>({});
  const [eventType, setEventType] = useState("any");
  const [award, setAward] = useState(1);
  const [divisor, setDivisor] = useState(1);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      setError(null);
      try {
        const next = await addPointMod(groupId, {
          item_id: target.item?.id ?? null,
          npc_id: target.npc?.id ?? null,
          event_type: eventType,
          award,
          divisor,
          description: description || null,
        });
        setMods(next);
        setTarget({});
        setDescription("");
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });

  const remove = (modId: number) =>
    startTransition(async () => {
      setError(null);
      try {
        setMods(await removePointMod(groupId, modId));
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });

  const saveAward = (mod: PointMod, patch: { award?: number; divisor?: number }) =>
    startTransition(async () => {
      setError(null);
      try {
        setMods(await editPointMod(groupId, mod.id, patch));
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });

  const q = query.trim().toLowerCase();
  const filtered = q ? mods.filter((m) => targetMatches(q, m)) : mods;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading
          title="Item & boss overrides"
          hint="Replace the default award for specific items and/or NPCs. For drops with a quantity, an override awards points per item; otherwise it's the divisor formula (or a flat award for non-drop types)."
        />
        {mods.length > 0 && (
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder="Search overrides…"
            className="w-full sm:w-72"
          />
        )}
      </div>

      {mods.length === 0 ? (
        <EmptyState title="No overrides yet" hint="All submissions use the base award rules." />
      ) : filtered.length === 0 ? (
        <Card padding="p-6">
          <p className="text-osrs-parchment-dark/50 text-center text-sm">
            No overrides match “{query}”.
          </p>
        </Card>
      ) : (
        <>
          <Card padding="p-0" className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-osrs-bronze/25 text-osrs-parchment-dark/60 border-b text-left text-xs uppercase">
                  <th className="px-4 py-2.5">Target</th>
                  <th className="px-4 py-2.5">Applies to</th>
                  <th className="px-4 py-2.5">Award</th>
                  <th className="px-4 py-2.5">Divisor</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((m) => (
                  <tr key={m.id} className="border-osrs-bronze/15 border-b last:border-0">
                    <td className="px-4 py-2">
                      <TargetChip
                        itemName={m.item_name}
                        itemId={m.item_id}
                        npcName={m.npc_name}
                        npcId={m.npc_id}
                      />
                      {m.description && (
                        <div className="text-osrs-parchment-dark/50 text-xs">{m.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {EVENT_TYPE_OPTIONS.find((o) => o.value === m.event_type)?.label ?? m.event_type}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        defaultValue={m.award}
                        disabled={disabled}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isFinite(v) && v !== m.award) saveAward(m, { award: v });
                        }}
                        className={`${field} w-24`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={1}
                        defaultValue={m.divisor}
                        disabled={disabled}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isFinite(v) && v !== m.divisor) saveAward(m, { divisor: v });
                        }}
                        className={`${field} w-28`}
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      {m.can_modify && (
                        <button
                          type="button"
                          onClick={() => remove(m.id)}
                          disabled={disabled || pending}
                          className="text-osrs-red/80 text-xs hover:underline disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pager
            page={current}
            totalPages={totalPages}
            onPage={setPage}
            summary={`${filtered.length}${q ? ` of ${mods.length}` : ""} override${mods.length === 1 ? "" : "s"}`}
          />
        </>
      )}

      <Card padding="p-4" className="space-y-3">
        <div className="text-osrs-parchment text-sm font-medium">Add an override</div>
        <TargetPicker groupId={groupId} target={target} setTarget={setTarget} disabled={disabled} />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            disabled={disabled}
            className={field}
          >
            {EVENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2">
            <span className="text-osrs-parchment-dark/70">Award</span>
            <input
              type="number"
              min={0}
              value={award}
              disabled={disabled}
              onChange={(e) => setAward(Number(e.target.value))}
              className={`${field} w-24`}
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-osrs-parchment-dark/70">Divisor</span>
            <input
              type="number"
              min={1}
              value={divisor}
              disabled={disabled}
              onChange={(e) => setDivisor(Number(e.target.value))}
              className={`${field} w-28`}
            />
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Note (optional)"
            disabled={disabled}
            className={`${field} flex-1`}
          />
          <button
            type="button"
            onClick={add}
            disabled={disabled || pending || (!target.item && !target.npc)}
            className="bg-osrs-gold/90 text-osrs-brown-dark rounded px-4 py-2 font-semibold hover:bg-osrs-gold disabled:opacity-50"
          >
            Add override
          </button>
        </div>
      </Card>
      {error && <Alert variant="error">{error}</Alert>}
    </section>
  );
}

/* --- Include / exclude lists --------------------------------------------------- */

/** One include/exclude column (blacklist/whitelist/no-split) with its own
 * search-aware pagination — a shared query from the parent narrows all three. */
function ListCard({
  type,
  entries,
  query,
  onRemove,
  disabled,
  pending,
}: {
  type: PointListType;
  entries: PointListEntry[];
  query: string;
  onRemove: (id: number) => void;
  disabled: boolean;
  pending: boolean;
}) {
  const items = entries.filter((e) => e.list_type === type);
  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((e) => targetMatches(q, e)) : items;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / LIST_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const shown = filtered.slice((current - 1) * LIST_PAGE_SIZE, current * LIST_PAGE_SIZE);

  // A search narrows every column at once — jump each back to its first page.
  useEffect(() => {
    setPage(1);
  }, [q]);

  return (
    <Card padding="p-4">
      <div className="text-osrs-parchment text-sm font-semibold capitalize">
        {type.replace("_", " ")}
        <span className="text-osrs-parchment-dark/40 ml-1.5 text-xs font-normal tabular-nums">
          {items.length}
        </span>
      </div>
      <p className="text-osrs-parchment-dark/60 mb-2 mt-0.5 text-xs">{LIST_TYPE_HELP[type]}</p>
      {items.length === 0 ? (
        <p className="text-osrs-parchment-dark/40 text-sm">Empty.</p>
      ) : filtered.length === 0 ? (
        <p className="text-osrs-parchment-dark/40 text-sm">No matches.</p>
      ) : (
        <>
          <ul className="space-y-1 text-sm">
            {shown.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <TargetChip
                  itemName={e.item_name}
                  itemId={e.item_id}
                  npcName={e.npc_name}
                  npcId={e.npc_id}
                />
                <button
                  type="button"
                  onClick={() => onRemove(e.id)}
                  disabled={disabled || pending}
                  className="text-osrs-red/80 text-xs hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="border-osrs-bronze/15 text-osrs-parchment-dark/60 mt-2 flex items-center justify-between border-t pt-2 text-xs">
              <button
                type="button"
                onClick={() => setPage(current - 1)}
                disabled={current <= 1}
                className="text-osrs-gold-bright disabled:text-osrs-parchment-dark/30 hover:underline"
              >
                ← Prev
              </button>
              <span className="tabular-nums">
                {current}/{totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(current + 1)}
                disabled={current >= totalPages}
                className="text-osrs-gold-bright disabled:text-osrs-parchment-dark/30 hover:underline"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function ListsSection({
  groupId,
  initial,
  disabled,
}: {
  groupId: number;
  initial: PointListEntry[];
  disabled: boolean;
}) {
  const [entries, setEntries] = useState(initial);
  const [listType, setListType] = useState<PointListType>("blacklist");
  const [target, setTarget] = useState<PickedTarget>({});
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      setError(null);
      try {
        const next = await addPointListEntry(groupId, {
          list_type: listType,
          item_id: target.item?.id ?? null,
          npc_id: target.npc?.id ?? null,
        });
        setEntries(next);
        setTarget({});
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });

  const remove = (entryId: number) =>
    startTransition(async () => {
      setError(null);
      try {
        setEntries(await removePointListEntry(groupId, entryId));
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading
          title="Include / exclude lists"
          hint="Fine-grained gates evaluated before any award: blacklist blocks, whitelist restricts, no-split prevents teammate sharing."
        />
        {entries.length > 0 && (
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search entries…"
            className="w-full sm:w-72"
          />
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {(["blacklist", "whitelist", "no_split"] as const).map((t) => (
          <ListCard
            key={t}
            type={t}
            entries={entries}
            query={query}
            onRemove={remove}
            disabled={disabled}
            pending={pending}
          />
        ))}
      </div>
      <Card padding="p-4" className="space-y-3">
        <div className="text-osrs-parchment text-sm font-medium">Add a list entry</div>
        <div className="flex flex-wrap items-start gap-3 text-sm">
          <select
            value={listType}
            onChange={(e) => setListType(e.target.value as PointListType)}
            disabled={disabled}
            className={field}
          >
            <option value="blacklist">Blacklist</option>
            <option value="whitelist">Whitelist</option>
            <option value="no_split">No split</option>
          </select>
          <div className="min-w-64 flex-1">
            <TargetPicker groupId={groupId} target={target} setTarget={setTarget} disabled={disabled} />
          </div>
          <button
            type="button"
            onClick={add}
            disabled={disabled || pending || (!target.item && !target.npc)}
            className="bg-osrs-gold/90 text-osrs-brown-dark rounded px-4 py-2 font-semibold hover:bg-osrs-gold disabled:opacity-50"
          >
            Add entry
          </button>
        </div>
      </Card>
      {error && <Alert variant="error">{error}</Alert>}
    </section>
  );
}

/* --- Timed boosts ---------------------------------------------------------------- */

function BoostsSection({
  groupId,
  initial,
  disabled,
}: {
  groupId: number;
  initial: PointBoost[];
  disabled: boolean;
}) {
  const [boosts, setBoosts] = useState(initial);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [eventType, setEventType] = useState("any");
  const [targetType, setTargetType] = useState<"any" | "item" | "npc">("any");
  const [target, setTarget] = useState<PickedTarget>({});
  const [operation, setOperation] = useState<"multiply" | "add" | "set">("multiply");
  const [operationValue, setOperationValue] = useState(2);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      setError(null);
      try {
        const next = await addPointBoost(groupId, {
          start_at: startAt,
          end_at: endAt,
          event_type: eventType,
          target_type: targetType,
          target_id:
            targetType === "item" ? (target.item?.id ?? null)
            : targetType === "npc" ? (target.npc?.id ?? null)
            : null,
          operation,
          operation_value: operationValue,
          description: description || null,
        });
        setBoosts(next);
        setDescription("");
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });

  const remove = (boostId: number) =>
    startTransition(async () => {
      setError(null);
      try {
        setBoosts(await removePointBoost(groupId, boostId));
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });

  const opLabel = (b: PointBoost) =>
    b.operation === "multiply"
      ? `×${b.operation_value}`
      : b.operation === "add"
        ? `+${b.operation_value}`
        : `=${b.operation_value}`;

  return (
    <section className="space-y-3">
      <SectionHeading
        title="Timed boosts"
        hint="Multiply, add to, or fix the computed award during a time window — e.g. double points weekend, or bonus points for a specific boss."
      />
      {boosts.length === 0 ? (
        <EmptyState title="No boosts scheduled" hint="Awards always use the standard rules." />
      ) : (
        <Card padding="p-0" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-osrs-bronze/25 text-osrs-parchment-dark/60 border-b text-left text-xs uppercase">
                <th className="px-4 py-2.5">Window</th>
                <th className="px-4 py-2.5">Applies to</th>
                <th className="px-4 py-2.5">Effect</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {boosts.map((b) => (
                <tr key={b.id} className="border-osrs-bronze/15 border-b last:border-0">
                  <td className="px-4 py-2">
                    {new Date(b.start_at).toLocaleString()} → {new Date(b.end_at).toLocaleString()}
                    {b.active && (
                      <span className="bg-osrs-green/20 text-osrs-green ml-2 rounded px-1.5 py-0.5 text-xs">
                        Active
                      </span>
                    )}
                    {b.description && (
                      <div className="text-osrs-parchment-dark/50 text-xs">{b.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {b.target_type === "any"
                      ? (EVENT_TYPE_OPTIONS.find((o) => o.value === b.event_type)?.label ??
                        b.event_type)
                      : (b.target_name ?? `${b.target_type} #${b.target_id}`)}
                  </td>
                  <td className="px-4 py-2 font-semibold">{opLabel(b)}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(b.id)}
                      disabled={disabled || pending}
                      className="text-osrs-red/80 text-xs hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Card padding="p-4" className="space-y-3 text-sm">
        <div className="text-osrs-parchment font-medium">Schedule a boost</div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-osrs-parchment-dark/70">From</span>
            <input
              type="datetime-local"
              value={startAt}
              disabled={disabled}
              onChange={(e) => setStartAt(e.target.value)}
              className={field}
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-osrs-parchment-dark/70">Until</span>
            <input
              type="datetime-local"
              value={endAt}
              disabled={disabled}
              onChange={(e) => setEndAt(e.target.value)}
              className={field}
            />
          </label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            disabled={disabled}
            className={field}
          >
            {EVENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <select
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value as "any" | "item" | "npc");
              setTarget({});
            }}
            disabled={disabled}
            className={field}
          >
            <option value="any">Any target</option>
            <option value="item">Specific item</option>
            <option value="npc">Specific NPC</option>
          </select>
          {targetType !== "any" && (
            <div className="min-w-64 flex-1">
              {targetType === "item" ? (
                target.item ? (
                  <button
                    type="button"
                    onClick={() => setTarget({})}
                    className="border-osrs-bronze/40 text-osrs-parchment w-full rounded border px-3 py-2 text-left"
                  >
                    {target.item.name} <span className="text-osrs-parchment-dark/50">✕</span>
                  </button>
                ) : (
                  <NameSearch
                    placeholder="Search items…"
                    iconBase="itemdb"
                    disabled={disabled}
                    search={(q) => searchPointItems(groupId, q)}
                    onPick={(e) => setTarget({ item: { id: e.id, name: e.name } })}
                  />
                )
              ) : target.npc ? (
                <button
                  type="button"
                  onClick={() => setTarget({})}
                  className="border-osrs-bronze/40 text-osrs-parchment w-full rounded border px-3 py-2 text-left"
                >
                  {target.npc.name} <span className="text-osrs-parchment-dark/50">✕</span>
                </button>
              ) : (
                <NameSearch
                  placeholder="Search NPCs…"
                  iconBase="npcdb"
                  disabled={disabled}
                  search={(q) => searchPointNpcs(groupId, q)}
                  onPick={(e) => setTarget({ npc: { id: e.id, name: e.name } })}
                />
              )}
            </div>
          )}
          <select
            value={operation}
            onChange={(e) => setOperation(e.target.value as "multiply" | "add" | "set")}
            disabled={disabled}
            className={field}
          >
            <option value="multiply">Multiply award by</option>
            <option value="add">Add to award</option>
            <option value="set">Set award to</option>
          </select>
          <input
            type="number"
            min={0}
            value={operationValue}
            disabled={disabled}
            onChange={(e) => setOperationValue(Number(e.target.value))}
            className={`${field} w-24`}
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Label (optional, e.g. Double-points weekend)"
            disabled={disabled}
            className={`${field} flex-1`}
          />
          <button
            type="button"
            onClick={add}
            disabled={
              disabled ||
              pending ||
              !startAt ||
              !endAt ||
              (targetType === "item" && !target.item) ||
              (targetType === "npc" && !target.npc)
            }
            className="bg-osrs-gold/90 text-osrs-brown-dark rounded px-4 py-2 font-semibold hover:bg-osrs-gold disabled:opacity-50"
          >
            Schedule boost
          </button>
        </div>
      </Card>
      {error && <Alert variant="error">{error}</Alert>}
    </section>
  );
}

/* --- Seasons ------------------------------------------------------------------------ */

function SeasonsSection({
  groupId,
  initial,
  disabled,
}: {
  groupId: number;
  initial: PointSeason[];
  disabled: boolean;
}) {
  const [seasons, setSeasons] = useState(initial);
  const [name, setName] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      setError(null);
      try {
        const season = await addPointSeason(groupId, {
          name: name.trim(),
          start_at: startAt,
          end_at: endAt,
        });
        setSeasons((prev) => [season, ...prev]);
        setName("");
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });

  const remove = (seasonId: number) =>
    startTransition(async () => {
      setError(null);
      try {
        await removePointSeason(groupId, seasonId);
        setSeasons((prev) => prev.filter((s) => s.id !== seasonId));
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });

  return (
    <section className="space-y-3">
      <SectionHeading
        title="Leaderboard seasons"
        hint="Named time windows (a recruitment drive, a quarterly competition) that appear as selectable views on your points leaderboard, alongside the standard daily / weekly / monthly / all-time views."
      />
      {seasons.length === 0 ? (
        <EmptyState
          title="No seasons defined"
          hint="The leaderboard offers daily, weekly, monthly and all-time views by default."
        />
      ) : (
        <Card padding="p-0">
          <ul className="divide-osrs-bronze/15 divide-y text-sm">
            {seasons.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div>
                  <span className="text-osrs-parchment font-medium">{s.name}</span>
                  {s.active && (
                    <span className="bg-osrs-green/20 text-osrs-green ml-2 rounded px-1.5 py-0.5 text-xs">
                      Active
                    </span>
                  )}
                  <div className="text-osrs-parchment-dark/50 text-xs">
                    {s.start_at ? new Date(s.start_at).toLocaleString() : "?"} →{" "}
                    {s.end_at ? new Date(s.end_at).toLocaleString() : "?"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/groups/${groupId}/points/leaderboard?period=season:${s.id}` as Route}
                    className="text-osrs-gold-bright text-xs hover:underline"
                  >
                    View standings
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    disabled={disabled || pending}
                    className="text-osrs-red/80 text-xs hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card padding="p-4" className="flex flex-wrap items-center gap-3 text-sm">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Season name (e.g. Summer Comp 2026)"
          disabled={disabled}
          className={`${field} min-w-56 flex-1`}
        />
        <input
          type="datetime-local"
          value={startAt}
          disabled={disabled}
          onChange={(e) => setStartAt(e.target.value)}
          className={field}
        />
        <span className="text-osrs-parchment-dark/50">→</span>
        <input
          type="datetime-local"
          value={endAt}
          disabled={disabled}
          onChange={(e) => setEndAt(e.target.value)}
          className={field}
        />
        <button
          type="button"
          onClick={add}
          disabled={disabled || pending || !name.trim() || !startAt || !endAt}
          className="bg-osrs-gold/90 text-osrs-brown-dark rounded px-4 py-2 font-semibold hover:bg-osrs-gold disabled:opacity-50"
        >
          Create season
        </button>
      </Card>
      {error && <Alert variant="error">{error}</Alert>}
    </section>
  );
}

/* --- Manual adjustments --------------------------------------------------------------- */

function AdjustSection({ groupId, disabled }: { groupId: number; disabled: boolean }) {
  const [player, setPlayer] = useState<{ id: number; name: string } | null>(null);
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setError(null);
      setResult(null);
      if (!player) return;
      try {
        const res = await adjustPoints(groupId, {
          player_id: player.id,
          amount,
          reason: reason.trim(),
        });
        setResult(
          `${res.amount > 0 ? "Added" : "Removed"} ${Math.abs(res.amount).toLocaleString()} point(s) ` +
            `${res.amount > 0 ? "to" : "from"} ${res.player_name}. New balance: ${res.new_total.toLocaleString()}.`,
        );
        setAmount(0);
        setReason("");
        setPlayer(null);
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });

  return (
    <section className="space-y-3">
      <SectionHeading
        title="Manual adjustment"
        hint="Add or remove points for a member (use a negative amount to remove). Every adjustment is recorded in the audit log — same as the Discord /add-group-points and /remove-group-points commands."
      />
      <Card padding="p-4" className="flex flex-wrap items-start gap-3 text-sm">
        <div className="min-w-56 flex-1">
          {player ? (
            <button
              type="button"
              onClick={() => setPlayer(null)}
              className="border-osrs-bronze/40 text-osrs-parchment w-full rounded border px-3 py-2 text-left"
            >
              {player.name} <span className="text-osrs-parchment-dark/50">✕</span>
            </button>
          ) : (
            <NameSearch
              placeholder="Search a member's RSN…"
              disabled={disabled}
              search={(q) => searchPointPlayers(groupId, q)}
              onPick={(e) => setPlayer({ id: e.id, name: e.name })}
            />
          )}
        </div>
        <label className="flex items-center gap-2">
          <span className="text-osrs-parchment-dark/70">Amount (±)</span>
          <input
            type="number"
            value={amount}
            disabled={disabled}
            onChange={(e) => setAmount(Number(e.target.value))}
            className={`${field} w-32`}
          />
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (3–120 characters, shown in history)"
          disabled={disabled}
          className={`${field} min-w-64 flex-1`}
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || pending || !player || amount === 0 || reason.trim().length < 3}
          className="bg-osrs-gold/90 text-osrs-brown-dark rounded px-4 py-2 font-semibold hover:bg-osrs-gold disabled:opacity-50"
        >
          {pending ? "Applying…" : "Apply adjustment"}
        </button>
      </Card>
      {result && <Alert variant="success">{result}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
    </section>
  );
}

/* --- History ------------------------------------------------------------------------------ */

function HistorySection({
  groupId,
  initial,
}: {
  groupId: number;
  initial: PointsHistoryPage;
}) {
  const [page, setPage] = useState(initial);
  const [pageNum, setPageNum] = useState(1);
  const [manualOnly, setManualOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = (nextPage: number, manual: boolean) =>
    startTransition(async () => {
      setError(null);
      try {
        const data = await loadPointsHistory(groupId, {
          page: nextPage,
          limit: 25,
          manual: manual || undefined,
        });
        setPage(data);
        setPageNum(nextPage);
        setManualOnly(manual);
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });

  const totalPages = Math.max(1, Math.ceil(page.meta.total / page.meta.limit));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeading title="Award history" hint="Every point award and manual adjustment." />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={manualOnly}
            onChange={(e) => load(1, e.target.checked)}
          />
          <span className="text-osrs-parchment-dark/70">Manual adjustments only</span>
        </label>
      </div>
      {page.entries.length === 0 ? (
        <EmptyState title="No point awards yet" hint="Awards appear here as members earn points." />
      ) : (
        <Card padding="p-0" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-osrs-bronze/25 text-osrs-parchment-dark/60 border-b text-left text-xs uppercase">
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Player</th>
                <th className="px-4 py-2.5">Points</th>
                <th className="px-4 py-2.5">Reason</th>
              </tr>
            </thead>
            <tbody>
              {page.entries.map((e) => (
                <tr key={e.id} className="border-osrs-bronze/15 border-b last:border-0">
                  <td className="text-osrs-parchment-dark/70 whitespace-nowrap px-4 py-2">
                    {e.date ? new Date(e.date).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2">{e.player_name}</td>
                  <td
                    className={`px-4 py-2 font-semibold ${e.amount < 0 ? "text-osrs-red" : "text-osrs-green"}`}
                  >
                    {e.amount > 0 ? `+${e.amount.toLocaleString()}` : e.amount.toLocaleString()}
                  </td>
                  <td className="text-osrs-parchment-dark/80 px-4 py-2">
                    {e.reason}
                    {e.manual && (
                      <span className="bg-osrs-gold/15 text-osrs-gold-bright ml-2 rounded px-1.5 py-0.5 text-xs">
                        Manual
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => load(pageNum - 1, manualOnly)}
            disabled={pending || pageNum <= 1}
            className="text-osrs-gold-bright disabled:text-osrs-parchment-dark/30 hover:underline"
          >
            ← Newer
          </button>
          <span className="text-osrs-parchment-dark/60">
            Page {pageNum} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => load(pageNum + 1, manualOnly)}
            disabled={pending || pageNum >= totalPages}
            className="text-osrs-gold-bright disabled:text-osrs-parchment-dark/30 hover:underline"
          >
            Older →
          </button>
        </div>
      )}
    </section>
  );
}

/* --- Danger zone ---------------------------------------------------------------------------- */

function DangerSection({ groupId }: { groupId: number }) {
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () =>
    startTransition(async () => {
      setError(null);
      setResult(null);
      try {
        const res = await resetGroupPoints(groupId);
        setResult(`Points reset. Removed ${res.deleted.toLocaleString()} award rows.`);
        setConfirm("");
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });

  return (
    <section className="space-y-3">
      <SectionHeading title="Danger zone" />
      <Card padding="p-4" className="border-osrs-red/30 flex flex-wrap items-center gap-3 text-sm">
        <div className="min-w-64 flex-1">
          <div className="text-osrs-parchment font-medium">Reset all points</div>
          <p className="text-osrs-parchment-dark/60 text-xs">
            Permanently deletes every point award for this group — including manual adjustments.
            Rules and settings are kept. This cannot be undone.
          </p>
        </div>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder='Type "RESET" to confirm'
          className={`${field} w-48`}
        />
        <button
          type="button"
          onClick={reset}
          disabled={pending || confirm.trim().toUpperCase() !== "RESET"}
          className="bg-osrs-red/80 hover:bg-osrs-red rounded px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Resetting…" : "Reset points"}
        </button>
      </Card>
      {result && <Alert variant="success">{result}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
    </section>
  );
}
