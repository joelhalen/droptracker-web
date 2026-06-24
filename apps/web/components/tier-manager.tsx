"use client";

import { useState, useTransition } from "react";
import type { SubscriptionTier } from "@droptracker/api-types";
import { formatPrice } from "@/lib/format";
import { deleteTier, saveTier } from "@/app/(admin)/admin/tiers/actions";

const blankTier = (): SubscriptionTier => ({
  key: "",
  name: "",
  description: "",
  price_cents: 0,
  currency: "USD",
  interval: "month",
  features: [],
  recommended: false,
});

export function TierManager({ tiers }: { tiers: SubscriptionTier[] }) {
  // `editing` holds the tier being edited (existing) or a blank (new); null = closed.
  const [editing, setEditing] = useState<{ tier: SubscriptionTier; isNew: boolean } | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing({ tier: blankTier(), isNew: true })}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium"
        >
          + Add tier
        </button>
      </div>

      <ul className="divide-osrs-bronze/20 divide-y">
        {tiers.map((t) => (
          <li key={t.key} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <span className="font-medium">{t.name}</span>
              <span className="text-osrs-parchment-dark/50 ml-2 text-xs">{t.key}</span>
              {t.recommended && (
                <span className="bg-osrs-gold/20 text-osrs-gold ml-2 rounded px-1.5 py-0.5 text-xs">
                  Popular
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="tabular-nums">{formatPrice(t)}</span>
              <button
                onClick={() => setEditing({ tier: t, isNew: false })}
                className="text-osrs-gold-bright hover:underline"
              >
                Edit
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <TierForm
          key={editing.tier.key || "new"}
          tier={editing.tier}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function TierForm({
  tier,
  isNew,
  onClose,
}: {
  tier: SubscriptionTier;
  isNew: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState<SubscriptionTier>(tier);
  const [featuresText, setFeaturesText] = useState(tier.features.join("\n"));
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof SubscriptionTier>(k: K, v: SubscriptionTier[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const field =
    "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";

  const onSave = () =>
    startTransition(async () => {
      const features = featuresText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      await saveTier({ ...form, features }, isNew);
      onClose();
    });

  const onDelete = () =>
    startTransition(async () => {
      await deleteTier(form.key);
      onClose();
    });

  return (
    <div className="border-osrs-gold/40 space-y-4 rounded border p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-osrs-gold font-semibold">{isNew ? "New tier" : `Edit ${tier.name}`}</h3>
        <button onClick={onClose} className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright">
          Close
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Key</span>
          <input
            value={form.key}
            onChange={(e) => set("key", e.target.value.replace(/\s+/g, "_").toLowerCase())}
            disabled={!isNew}
            className={`${field} disabled:opacity-60`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Name</span>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Price (cents)</span>
          <input
            type="number"
            min={0}
            value={form.price_cents}
            onChange={(e) => set("price_cents", Math.max(0, Number(e.target.value)))}
            className={field}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Interval</span>
          <select
            value={form.interval}
            onChange={(e) => set("interval", e.target.value as SubscriptionTier["interval"])}
            className={field}
          >
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Description</span>
        <input
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          className={field}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Features (one per line)</span>
        <textarea
          value={featuresText}
          onChange={(e) => setFeaturesText(e.target.value)}
          rows={4}
          className={field}
        />
      </label>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.recommended}
          onChange={(e) => set("recommended", e.target.checked)}
          className="size-4"
        />
        Mark as recommended
      </label>

      <div className="flex items-center justify-between">
        <button
          onClick={onSave}
          disabled={pending || !form.key || !form.name}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save tier"}
        </button>
        {!isNew && (
          <button
            onClick={onDelete}
            disabled={pending}
            className="text-osrs-red hover:bg-osrs-red/10 rounded px-3 py-2 text-sm disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
