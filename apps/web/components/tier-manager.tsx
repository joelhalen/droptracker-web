"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type {
  AdminEventRateLimit,
  EntitlementField,
  SubscriptionTier,
  TierFlairStyle,
} from "@droptracker/api-types";
import {
  ENTITLEMENT_FIELDS,
  entitlementFieldsForScope,
  TIER_FLAIR_STYLES,
} from "@droptracker/api-types";
import { formatPrice } from "@/lib/format";
import { resolveFlair } from "@/lib/tier-flair";
import { InlineMarkdown } from "@/components/markdown";
import { Alert, Badge, Button } from "@/components/ui";
import { QuantityInput } from "@/components/quantity-input";
import { deleteTier, saveTier } from "@/app/(site)/(admin)/admin/tiers/actions";

/** `openKey` value for the "Add tier" editor. */
const NEW_TIER = "__new__";

const blankTier = (): SubscriptionTier => ({
  key: "",
  name: "",
  description: "",
  scope: "group",
  price_cents: 0,
  currency: "USD",
  interval: "month",
  features: [],
  entitlements: Object.fromEntries(ENTITLEMENT_FIELDS.map((f) => [f.key, f.default])),
  flair: "none",
  recommended: false,
});

const inputClass =
  "border-osrs-bronze/40 bg-osrs-surface-2 focus:border-osrs-gold focus:ring-osrs-gold/20 w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 disabled:opacity-60";

const splitFeatures = (text: string) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

/** A tier's event allowance from /admin/event-limits. Any enabled rule above
 * zero grants event access even with the `events` capability off (the backend
 * folds it in), and the "*" rule is the overall cap. */
type EventAllowance = { grants: boolean; total: AdminEventRateLimit | null };

function eventAllowance(rules: AdminEventRateLimit[], tierKey: string): EventAllowance {
  const mine = rules.filter((r) => r.tier_key === tierKey && r.enabled);
  return {
    grants: mine.some((r) => r.max_events > 0),
    total: mine.find((r) => r.type_key === "*") ?? null,
  };
}

function allowanceText(a: EventAllowance, hasEvents: boolean): string {
  if (!hasEvents && !a.grants) return "None";
  if (!a.total) return "No limit";
  return `${a.total.max_events} per ${a.total.window_days} days`;
}

function entitlementValue(tier: SubscriptionTier, field: EntitlementField): boolean | number {
  const raw = tier.entitlements?.[field.key];
  if (field.kind === "int") return Number(raw ?? field.default);
  return Boolean(raw ?? field.default);
}

/** Live sample of a flair style. */
function FlairSwatch({ style, size = "md" }: { style: TierFlairStyle; size?: "sm" | "md" }) {
  const f = resolveFlair(style);
  const pad = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  return (
    <span
      className={`border-osrs-bronze/30 bg-osrs-brown-dark/40 inline-flex items-center gap-1.5 rounded border ${pad}`}
    >
      {f ? (
        <>
          <span aria-hidden style={f.markerStyle}>
            {f.marker}
          </span>
          <span className={f.nameClassName} style={f.nameStyle}>
            Sample Clan
          </span>
        </>
      ) : (
        <span className="text-osrs-parchment font-medium">Sample Clan</span>
      )}
    </span>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-osrs-gold" : "bg-osrs-stone/50"
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 left-0.5 inline-block size-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

/** One capability: text on the left taking all the room it needs, the
 * control on the right at a fixed width. */
function CapabilityRow({
  field,
  value,
  onChange,
  note,
}: {
  field: EntitlementField;
  value: boolean | number;
  onChange: (v: boolean | number) => void;
  note?: React.ReactNode;
}) {
  const isInt = field.kind === "int";
  return (
    <div
      className={`border-osrs-bronze/15 flex justify-between gap-x-4 gap-y-2 border-b py-3 last:border-b-0 ${
        // Number boxes drop under the text on a phone; switches fit beside it.
        isInt ? "flex-col sm:flex-row sm:items-center" : "items-center"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{field.label}</div>
        <p className="text-osrs-parchment-dark/60 mt-0.5 text-xs">{field.help}</p>
        {note && <p className="text-osrs-gold/90 mt-1 text-xs">{note}</p>}
      </div>
      {field.kind === "int" ? (
        <div className="flex shrink-0 items-center gap-2">
          <QuantityInput
            min={0}
            value={Number(value)}
            emptyAs={0}
            placeholder="0"
            onChange={(v) => onChange(v)}
            aria-label={field.label}
            className="border-osrs-bronze/40 bg-osrs-surface-2 focus:border-osrs-gold w-20 rounded-lg border px-2 py-1.5 text-right text-sm tabular-nums outline-none"
          />
          {field.unit && (
            <span className="text-osrs-parchment-dark/60 w-14 text-xs">{field.unit}</span>
          )}
        </div>
      ) : (
        <Switch checked={Boolean(value)} onChange={onChange} label={field.label} />
      )}
    </div>
  );
}

/** Short summary chips for a tier row: the switched-on features, then the
 * numeric limits. */
function CapabilityChips({
  tier,
  allowance,
}: {
  tier: SubscriptionTier;
  allowance: EventAllowance;
}) {
  const fields = entitlementFieldsForScope(tier.scope);
  const on = fields.filter(
    (f) =>
      f.kind !== "int" &&
      (entitlementValue(tier, f) ||
        (f.key === "events" && tier.scope === "group" && allowance.grants)),
  );
  const limits = fields.filter((f) => f.kind === "int");
  if (!on.length && !limits.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {on.map((f) => (
        <span
          key={f.key}
          className="bg-osrs-green/10 text-osrs-green rounded px-1.5 py-0.5 text-[11px]"
        >
          {f.label}
        </span>
      ))}
      {tier.scope === "group" && allowance.total && (
        <span className="bg-osrs-bronze/15 text-osrs-parchment-dark/80 rounded px-1.5 py-0.5 text-[11px] tabular-nums">
          Events: {allowance.total.max_events} per {allowance.total.window_days} days
        </span>
      )}
      {limits.map((f) => (
        <span
          key={f.key}
          className="bg-osrs-bronze/15 text-osrs-parchment-dark/80 rounded px-1.5 py-0.5 text-[11px] tabular-nums"
        >
          {f.label}: {String(entitlementValue(tier, f))}
        </span>
      ))}
    </div>
  );
}

/** The tier as its card renders on /premium. */
function CardPreview({ tier, features }: { tier: SubscriptionTier; features: string[] }) {
  return (
    <div
      className={`bg-osrs-surface-1 shadow-osrs-card flex flex-col rounded-xl border p-5 ${
        tier.recommended ? "border-osrs-gold/60" : "border-osrs-bronze/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-osrs-gold-bright text-lg font-semibold">
          {tier.name || "Tier name"}
        </span>
        {tier.recommended && <Badge variant="gold">Popular</Badge>}
      </div>
      <div className="text-osrs-parchment mt-1 text-2xl font-bold">{formatPrice(tier)}</div>
      {tier.description && (
        <p className="text-osrs-parchment-dark/70 mt-1 text-sm">{tier.description}</p>
      )}
      {features.length > 0 ? (
        <ul className="mt-4 space-y-1.5 text-sm">
          {features.map((f, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-osrs-green">✓</span>
              <InlineMarkdown>{f}</InlineMarkdown>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-osrs-parchment-dark/50 mt-4 text-sm">No features listed yet.</p>
      )}
    </div>
  );
}

export function TierManager({
  tiers,
  eventLimits,
}: {
  tiers: SubscriptionTier[];
  eventLimits: AdminEventRateLimit[];
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const allowanceFor = (key: string) => eventAllowance(eventLimits, key);

  const groupTiers = useMemo(
    () => tiers.filter((t) => t.scope === "group").sort((a, b) => a.price_cents - b.price_cents),
    [tiers],
  );
  const userTiers = useMemo(
    () => tiers.filter((t) => t.scope === "user").sort((a, b) => a.price_cents - b.price_cents),
    [tiers],
  );

  const toggle = (key: string) => setOpenKey((cur) => (cur === key ? null : key));

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-osrs-parchment-dark/70 max-w-2xl text-sm">
          Each tier has a pricing card (shown on{" "}
          <Link href="/premium" className="text-osrs-gold-bright hover:underline">
            /premium
          </Link>
          ) and a set of capabilities that decide what subscribers can actually use. Event
          allowances per tier are set on{" "}
          <Link href="/admin/event-limits" className="text-osrs-gold-bright hover:underline">
            Event limits
          </Link>
          .
        </p>
        <Button variant="secondary" size="sm" onClick={() => toggle(NEW_TIER)}>
          {openKey === NEW_TIER ? "Cancel new tier" : "+ Add tier"}
        </Button>
      </div>

      {openKey === NEW_TIER && (
        <TierEditor
          key={NEW_TIER}
          tier={blankTier()}
          isNew
          allowance={allowanceFor("")}
          onClose={() => setOpenKey(null)}
        />
      )}

      <TierList
        title="Group plans"
        hint="What a clan gets. Groups without a paid plan fall back to the $0 tier."
        tiers={groupTiers}
        openKey={openKey}
        onToggle={toggle}
        onClose={() => setOpenKey(null)}
        allowanceFor={allowanceFor}
      />

      {groupTiers.length > 1 && (
        <CompareTable
          tiers={groupTiers}
          allowanceFor={allowanceFor}
          onEdit={(key) => setOpenKey(key)}
        />
      )}

      <TierList
        title="Personal plans"
        hint="Perks for one player, independent of their groups' plans."
        tiers={userTiers}
        openKey={openKey}
        onToggle={toggle}
        onClose={() => setOpenKey(null)}
        allowanceFor={allowanceFor}
      />
    </div>
  );
}

function TierList({
  title,
  hint,
  tiers,
  openKey,
  onToggle,
  onClose,
  allowanceFor,
}: {
  title: string;
  hint: string;
  tiers: SubscriptionTier[];
  openKey: string | null;
  onToggle: (key: string) => void;
  onClose: () => void;
  allowanceFor: (key: string) => EventAllowance;
}) {
  if (!tiers.length) return null;
  return (
    <section>
      <h2 className="text-osrs-gold text-lg font-semibold">{title}</h2>
      <p className="text-osrs-parchment-dark/60 mb-3 text-xs">{hint}</p>
      <ul className="space-y-3">
        {tiers.map((t) => {
          const open = openKey === t.key;
          return (
            <li
              key={t.key}
              className={`bg-osrs-surface-1 rounded-xl border ${
                open ? "border-osrs-gold/50" : "border-osrs-bronze/25"
              }`}
            >
              <button
                type="button"
                onClick={() => onToggle(t.key)}
                aria-expanded={open}
                className="hover:bg-osrs-surface-2/40 flex w-full flex-wrap items-start justify-between gap-3 rounded-xl p-4 text-left transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-osrs-parchment-dark/50 font-mono text-xs">{t.key}</span>
                    {t.price_cents === 0 && <Badge>Default for unpaid groups</Badge>}
                    {t.recommended && <Badge variant="gold">Popular</Badge>}
                    {t.scope === "group" && t.flair !== "none" && (
                      <FlairSwatch style={t.flair} size="sm" />
                    )}
                  </div>
                  <CapabilityChips tier={t} allowance={allowanceFor(t.key)} />
                </div>
                <div className="flex shrink-0 items-center gap-4 text-sm">
                  <span className="tabular-nums">{formatPrice(t)}</span>
                  <span className="text-osrs-gold-bright">{open ? "Close" : "Edit"}</span>
                </div>
              </button>
              {open && (
                <div className="border-osrs-bronze/20 border-t p-4">
                  <TierEditor
                    tier={t}
                    isNew={false}
                    allowance={allowanceFor(t.key)}
                    onClose={onClose}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Every group tier's capabilities side by side. */
function CompareTable({
  tiers,
  allowanceFor,
  onEdit,
}: {
  tiers: SubscriptionTier[];
  allowanceFor: (key: string) => EventAllowance;
  onEdit: (key: string) => void;
}) {
  const fields = entitlementFieldsForScope("group");
  return (
    <section>
      <h2 className="text-osrs-gold text-lg font-semibold">Compare group plans</h2>
      <p className="text-osrs-parchment-dark/60 mb-3 text-xs">
        What each plan can use right now. Click a plan to edit it.
      </p>
      <div className="border-osrs-bronze/25 overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="bg-osrs-surface-2/60">
              <th className="px-3 py-2 text-left font-medium">Capability</th>
              {tiers.map((t) => (
                <th key={t.key} className="px-3 py-2 text-center font-medium">
                  <button
                    type="button"
                    onClick={() => onEdit(t.key)}
                    className="text-osrs-gold-bright hover:underline"
                  >
                    {t.name}
                  </button>
                  <div className="text-osrs-parchment-dark/60 text-xs font-normal tabular-nums">
                    {formatPrice(t)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-osrs-bronze/15 border-t">
              <td className="px-3 py-2">
                Events you can start{" "}
                <Link
                  href="/admin/event-limits"
                  className="text-osrs-gold-bright text-xs hover:underline"
                >
                  (Event limits)
                </Link>
              </td>
              {tiers.map((t) => (
                <td key={t.key} className="px-3 py-2 text-center text-xs tabular-nums">
                  {allowanceText(allowanceFor(t.key), Boolean(t.entitlements?.events))}
                </td>
              ))}
            </tr>
            {fields.map((f) => (
              <tr key={f.key} className="border-osrs-bronze/15 border-t">
                <td className="px-3 py-2">{f.label}</td>
                {tiers.map((t) => {
                  const v =
                    entitlementValue(t, f) || (f.key === "events" && allowanceFor(t.key).grants);
                  return (
                    <td key={t.key} className="px-3 py-2 text-center tabular-nums">
                      {f.kind === "int" ? (
                        String(v)
                      ) : v ? (
                        <span className="text-osrs-green" aria-label="Yes">
                          ✓
                        </span>
                      ) : (
                        <span className="text-osrs-parchment-dark/30" aria-label="No">
                          –
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TierEditor({
  tier,
  isNew,
  allowance,
  onClose,
}: {
  tier: SubscriptionTier;
  isNew: boolean;
  allowance: EventAllowance;
  onClose: () => void;
}) {
  const [form, setForm] = useState<SubscriptionTier>(tier);
  const [featuresText, setFeaturesText] = useState(tier.features.join("\n"));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Bring the editor into view when it opens, wherever the row sits.
  useEffect(() => {
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const set = <K extends keyof SubscriptionTier>(k: K, v: SubscriptionTier[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setEntitlement = (key: string, value: boolean | number) =>
    setForm((f) => ({ ...f, entitlements: { ...f.entitlements, [key]: value } }));

  // Scope decides which capability registry applies — reset on change.
  const setScope = (scope: SubscriptionTier["scope"]) =>
    setForm((f) => ({
      ...f,
      scope,
      entitlements: Object.fromEntries(
        entitlementFieldsForScope(scope).map((ent) => [ent.key, ent.default]),
      ),
    }));

  const features = splitFeatures(featuresText);
  const fields = entitlementFieldsForScope(form.scope);
  const switches = fields.filter((f) => f.kind !== "int");
  const limits = fields.filter((f) => f.kind === "int");

  const dirty =
    isNew ||
    JSON.stringify({ ...form, features }) !==
      JSON.stringify({ ...tier, features: splitFeatures(tier.features.join("\n")) });

  const onSave = () =>
    startTransition(async () => {
      setError(null);
      try {
        await saveTier({ ...form, features }, isNew);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save the tier.");
      }
    });

  const onDelete = () =>
    startTransition(async () => {
      setError(null);
      try {
        await deleteTier(form.key);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't delete the tier.");
        setConfirmDelete(false);
      }
    });

  return (
    <div ref={rootRef} className="scroll-mt-24 space-y-6">
      {isNew && <h3 className="text-osrs-gold text-lg font-semibold">New tier</h3>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-osrs-gold mb-2 text-sm font-semibold">Plan details</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Name</span>
                <input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Key</span>
                <input
                  value={form.key}
                  onChange={(e) => set("key", e.target.value.replace(/\s+/g, "_").toLowerCase())}
                  disabled={!isNew}
                  className={`${inputClass} font-mono`}
                />
                {!isNew && (
                  <span className="text-osrs-parchment-dark/50 mt-1 block text-xs">
                    Fixed once created: subscriptions refer to it.
                  </span>
                )}
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Price ({form.currency})</span>
                <QuantityInput
                  min={0}
                  integer={false}
                  step={0.01}
                  value={form.price_cents / 100}
                  emptyAs={0}
                  placeholder="0.00"
                  onChange={(dollars) => set("price_cents", Math.round(dollars * 100))}
                  className={inputClass}
                />
                <span className="text-osrs-parchment-dark/50 mt-1 block text-xs">
                  {form.price_cents === 0
                    ? "Free. Not offered at checkout."
                    : `Shown as ${formatPrice(form)}.`}
                </span>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Billed</span>
                <select
                  value={form.interval}
                  onChange={(e) => set("interval", e.target.value as SubscriptionTier["interval"])}
                  className={inputClass}
                >
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                </select>
              </label>
              {isNew && (
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium">Applies to</span>
                  <select
                    value={form.scope}
                    onChange={(e) => setScope(e.target.value as SubscriptionTier["scope"])}
                    className={inputClass}
                  >
                    <option value="group">A group (clan plan)</option>
                    <option value="user">One player (personal supporter)</option>
                  </select>
                </label>
              )}
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Description</span>
              <textarea
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
                rows={2}
                className={inputClass}
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-4">
              {form.scope === "group" && (
                <label className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium">Badge style</span>
                  <select
                    value={form.flair}
                    onChange={(e) => set("flair", e.target.value as SubscriptionTier["flair"])}
                    className={`${inputClass} w-40`}
                  >
                    {TIER_FLAIR_STYLES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <FlairSwatch style={form.flair} />
                </label>
              )}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Highlight as popular</span>
                <Switch
                  checked={form.recommended}
                  onChange={(v) => set("recommended", v)}
                  label="Highlight as popular"
                />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-osrs-gold mb-1 text-sm font-semibold">Pricing card</legend>
            <p className="text-osrs-parchment-dark/60 mb-2 text-xs">
              One feature per line. Supports **bold**, *italic* and [links](/path). This is display
              text only: what subscribers can use is set under Capabilities.
            </p>
            <textarea
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              rows={Math.max(5, features.length + 1)}
              className={inputClass}
            />
          </fieldset>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="text-osrs-parchment-dark/60 mb-2 text-xs">Preview on /premium</div>
          <CardPreview tier={form} features={features} />
        </aside>
      </div>

      <fieldset className="border-osrs-bronze/20 rounded-xl border p-4">
        <legend className="text-osrs-gold px-1 text-sm font-semibold">Capabilities</legend>
        <p className="text-osrs-parchment-dark/60 mb-2 text-xs">
          What {form.scope === "user" ? "a supporter" : "a group"} on this tier can actually use.
          Changes apply within about a minute of saving.
        </p>
        <div className="grid gap-x-8 lg:grid-cols-2">
          <div>
            <h4 className="text-osrs-parchment-dark/70 mt-2 text-xs font-semibold tracking-wide uppercase">
              Features
            </h4>
            {switches.map((f) => (
              <CapabilityRow
                key={f.key}
                field={f}
                value={entitlementValue(form, f)}
                onChange={(v) => setEntitlement(f.key, v)}
                note={
                  f.key === "events" && form.scope === "group" && allowance.grants ? (
                    <>
                      This tier gets events from its{" "}
                      <Link href="/admin/event-limits" className="underline">
                        Event limits
                      </Link>{" "}
                      ({allowanceText(allowance, true)}) whether or not this is on. Turning it on
                      only matters if those rules are removed.
                    </>
                  ) : undefined
                }
              />
            ))}
          </div>
          {limits.length > 0 && (
            <div>
              <h4 className="text-osrs-parchment-dark/70 mt-2 text-xs font-semibold tracking-wide uppercase">
                Limits
              </h4>
              {limits.map((f) => (
                <CapabilityRow
                  key={f.key}
                  field={f}
                  value={entitlementValue(form, f)}
                  onChange={(v) => setEntitlement(f.key, v)}
                />
              ))}
            </div>
          )}
        </div>
      </fieldset>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="border-osrs-bronze/20 bg-osrs-surface-1/95 sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Button onClick={onSave} disabled={pending || !dirty || !form.key || !form.name}>
            {pending ? "Saving…" : isNew ? "Create tier" : "Save changes"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          {!isNew && dirty && <span className="text-osrs-gold text-xs">Unsaved changes</span>}
        </div>
        {!isNew &&
          (confirmDelete ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-osrs-parchment-dark/80">Delete {tier.name}?</span>
              <button
                type="button"
                onClick={onDelete}
                disabled={pending}
                className="bg-osrs-red/20 text-osrs-red hover:bg-osrs-red/30 rounded px-3 py-1.5 disabled:opacity-50"
              >
                Yes, delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-osrs-parchment-dark/70 hover:text-osrs-parchment px-2 py-1.5"
              >
                Keep
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={pending}
              className="text-osrs-red hover:bg-osrs-red/10 rounded px-3 py-2 text-sm disabled:opacity-50"
            >
              Delete tier
            </button>
          ))}
      </div>
    </div>
  );
}
