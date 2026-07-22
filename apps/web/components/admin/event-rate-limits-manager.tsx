"use client";

import { useMemo, useState, useTransition } from "react";
import type {
  AdminEventRateLimit,
  AdminEventType,
  SubscriptionTier,
} from "@droptracker/api-types";
import { EVENT_RATE_LIMIT_ALL_TYPES } from "@droptracker/api-types";
import {
  deleteEventRateLimit,
  putEventRateLimit,
} from "@/app/(site)/(admin)/admin/event-limits/actions";
import { Alert, Card } from "@/components/ui";

/**
 * Superadmin matrix of per-tier event frequency caps (web65a): one card per
 * group tier, one rule row per event format plus the all-formats total. A
 * scope without a rule is unlimited; a rule > 0 on a tier without the Events
 * entitlement grants that tier rate-limited event access (the "free events
 * every so often" lever).
 */
export function EventRateLimitsManager({
  tiers,
  types,
  initial,
}: {
  tiers: SubscriptionTier[];
  types: AdminEventType[];
  initial: AdminEventRateLimit[];
}) {
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const groupTiers = useMemo(
    () =>
      tiers
        .filter((t) => t.scope === "group")
        .sort((a, b) => a.price_cents - b.price_cents),
    [tiers],
  );
  // Groups with no live subscription resolve to the "free" tier when one
  // exists, else "basic" — rules on that tier govern unsubscribed groups too.
  const fallbackKey = useMemo(() => {
    if (groupTiers.some((t) => t.key === "free")) return "free";
    if (groupTiers.some((t) => t.key === "basic")) return "basic";
    return null;
  }, [groupTiers]);

  const scopes = useMemo(
    () => [
      {
        key: EVENT_RATE_LIMIT_ALL_TYPES as string,
        label: "All event types",
        hint: "Total events of every format combined.",
      },
      ...types.map((t) => ({ key: t.key as string, label: t.label, hint: "" })),
    ],
    [types],
  );

  const upsertRow = (row: AdminEventRateLimit) =>
    setRows((prev) => {
      const i = prev.findIndex(
        (r) => r.tier_key === row.tier_key && r.type_key === row.type_key,
      );
      if (i === -1) return [...prev, row];
      return prev.map((r, j) => (j === i ? row : r));
    });
  const removeRow = (id: number) => setRows((prev) => prev.filter((r) => r.id !== id));

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      {groupTiers.map((tier) => (
        <TierCard
          key={tier.key}
          tier={tier}
          isFallback={tier.key === fallbackKey}
          scopes={scopes}
          rules={rows.filter((r) => r.tier_key === tier.key)}
          onUpserted={upsertRow}
          onRemoved={removeRow}
          onError={setError}
        />
      ))}
      {groupTiers.length === 0 && (
        <Card padding="p-6">
          <p className="text-osrs-parchment-dark/60 text-sm">
            No group subscription tiers exist yet — create tiers first, then set
            their event limits here.
          </p>
        </Card>
      )}
    </div>
  );
}

function TierCard({
  tier,
  isFallback,
  scopes,
  rules,
  onUpserted,
  onRemoved,
  onError,
}: {
  tier: SubscriptionTier;
  isFallback: boolean;
  scopes: { key: string; label: string; hint: string }[];
  rules: AdminEventRateLimit[];
  onUpserted: (row: AdminEventRateLimit) => void;
  onRemoved: (id: number) => void;
  onError: (msg: string | null) => void;
}) {
  const hasEvents = tier.entitlements?.events === true;
  const price = `$${(tier.price_cents / 100).toFixed(2)}/${tier.interval === "year" ? "yr" : "mo"}`;

  return (
    <Card padding="p-6">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-osrs-gold text-lg font-semibold">{tier.name}</h2>
        <span className="text-osrs-parchment-dark/50 text-xs">
          {tier.key} · {price}
        </span>
        <span
          className={`rounded px-2 py-0.5 text-xs ${
            hasEvents
              ? "bg-osrs-gold/15 text-osrs-gold"
              : "bg-osrs-stone/40 text-osrs-parchment-dark/70"
          }`}
        >
          {hasEvents ? "Full Events access" : "No Events entitlement"}
        </span>
        {isFallback && (
          <span className="bg-osrs-gold-bright/15 text-osrs-gold-bright rounded px-2 py-0.5 text-xs">
            Non-premium fallback
          </span>
        )}
      </div>
      <p className="text-osrs-parchment-dark/60 mb-4 text-xs">
        {hasEvents
          ? "This tier has the Events entitlement — rules below only cap how often events run."
          : "This tier can't run events today. A rule above zero grants it rate-limited access " +
            "(events allowed, but only at the configured pace)."}
        {isFallback && (
          <>
            {" "}
            <span className="text-osrs-gold-bright/80">
              Groups without an active subscription resolve to this tier — set a cap here to give
              regular non-premium groups a limited number of trial events.
            </span>
          </>
        )}
      </p>

      <div className="divide-osrs-bronze/15 divide-y">
        {scopes.map((scope) => (
          <RuleRow
            key={scope.key}
            tierKey={tier.key}
            scope={scope}
            rule={rules.find((r) => r.type_key === scope.key)}
            onUpserted={onUpserted}
            onRemoved={onRemoved}
            onError={onError}
          />
        ))}
      </div>
    </Card>
  );
}

function RuleRow({
  tierKey,
  scope,
  rule,
  onUpserted,
  onRemoved,
  onError,
}: {
  tierKey: string;
  scope: { key: string; label: string; hint: string };
  rule: AdminEventRateLimit | undefined;
  onUpserted: (row: AdminEventRateLimit) => void;
  onRemoved: (id: number) => void;
  onError: (msg: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [maxStr, setMaxStr] = useState(rule ? String(rule.max_events) : "");
  const [daysStr, setDaysStr] = useState(rule ? String(rule.window_days) : "");
  const [enabled, setEnabled] = useState(rule ? rule.enabled : true);

  const max = /^\d+$/.test(maxStr) ? Number(maxStr) : null;
  const days = /^\d+$/.test(daysStr) ? Number(daysStr) : null;
  const valid = max !== null && max <= 1000 && days !== null && days >= 1 && days <= 365;
  const dirty =
    rule === undefined
      ? maxStr !== "" || daysStr !== ""
      : max !== rule.max_events || days !== rule.window_days || enabled !== rule.enabled;

  const save = () => {
    if (!valid) return;
    onError(null);
    startTransition(async () => {
      const res = await putEventRateLimit({
        tier_key: tierKey,
        type_key: scope.key,
        max_events: max,
        window_days: days,
        enabled,
      });
      if (res.ok) onUpserted(res.row);
      else onError(res.error);
    });
  };

  const remove = () => {
    if (!rule) return;
    onError(null);
    startTransition(async () => {
      const res = await deleteEventRateLimit(rule.id);
      if (res.ok) {
        onRemoved(rule.id);
        setMaxStr("");
        setDaysStr("");
        setEnabled(true);
      } else onError(res.error);
    });
  };

  const num =
    "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-16 rounded border px-2 py-1 text-center text-sm outline-none disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
      <div className="min-w-40 flex-1">
        <span className="text-osrs-parchment block text-sm">{scope.label}</span>
        <span className="text-osrs-parchment-dark/50 block text-xs">
          {rule
            ? rule.enabled
              ? `${rule.max_events} per ${rule.window_days} days`
              : `${rule.max_events} per ${rule.window_days} days (disabled)`
            : scope.hint || "No cap — unlimited."}
        </span>
      </div>

      <label className="flex items-center gap-1.5 text-sm">
        <input
          value={maxStr}
          onChange={(e) => setMaxStr(e.target.value)}
          disabled={pending}
          inputMode="numeric"
          placeholder="—"
          aria-label={`Max ${scope.label} events for ${tierKey}`}
          className={num}
        />
        <span className="text-osrs-parchment-dark/60 whitespace-nowrap text-xs">per</span>
        <input
          value={daysStr}
          onChange={(e) => setDaysStr(e.target.value)}
          disabled={pending}
          inputMode="numeric"
          placeholder="—"
          aria-label={`Window in days for ${scope.label} events on ${tierKey}`}
          className={num}
        />
        <span className="text-osrs-parchment-dark/60 whitespace-nowrap text-xs">days</span>
      </label>

      <label className="flex items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          checked={enabled}
          disabled={pending}
          onChange={(e) => setEnabled(e.target.checked)}
          className="accent-osrs-gold"
        />
        <span className="text-osrs-parchment-dark/70">Enabled</span>
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending || !valid || !dirty}
          onClick={save}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1 text-xs font-medium disabled:opacity-40"
        >
          {rule ? "Save" : "Add cap"}
        </button>
        {rule && (
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            className="text-osrs-red/80 hover:text-osrs-red text-xs disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
