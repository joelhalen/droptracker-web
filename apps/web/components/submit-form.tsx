"use client";

import { useState, useTransition } from "react";
import type { ManualSubmission, Me } from "@droptracker/api-types";
import { submitDrop } from "@/app/(dashboard)/submit/actions";

const TYPES: { value: ManualSubmission["type"]; label: string }[] = [
  { value: "drop", label: "Drop" },
  { value: "clog", label: "Collection log" },
  { value: "pb", label: "Personal best" },
  { value: "ca", label: "Combat achievement" },
  { value: "pet", label: "Pet" },
];

export function SubmitForm({ players }: { players: Me["players"] }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [form, setForm] = useState<ManualSubmission>({
    type: "drop",
    player_id: players[0]?.id ?? 0,
    quantity: 1,
  });

  const set = <K extends keyof ManualSubmission>(k: K, v: ManualSubmission[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await submitDrop(form);
      setResult(`Submitted (#${res.id}).`);
    });
  };

  const field = "border-osrs-bronze/40 bg-osrs-brown-dark/40 rounded border px-3 py-2 text-sm w-full";

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Type</span>
        <select
          value={form.type}
          onChange={(e) => set("type", e.target.value as ManualSubmission["type"])}
          className={field}
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Account</span>
        <select
          value={form.player_id}
          onChange={(e) => set("player_id", Number(e.target.value))}
          className={field}
        >
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Source NPC / boss</span>
        <input
          value={form.npc_name ?? ""}
          onChange={(e) => set("npc_name", e.target.value)}
          className={field}
          placeholder="e.g. Vorkath"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Item</span>
        <input
          value={form.item_name ?? ""}
          onChange={(e) => set("item_name", e.target.value)}
          className={field}
          placeholder="e.g. Dragon hunter lance"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Value (GP)</span>
          <input
            type="number"
            min={0}
            value={form.value ?? ""}
            onChange={(e) => set("value", e.target.value ? Number(e.target.value) : undefined)}
            className={field}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Quantity</span>
          <input
            type="number"
            min={1}
            value={form.quantity}
            onChange={(e) => set("quantity", Math.max(1, Number(e.target.value)))}
            className={field}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Notes</span>
        <textarea
          value={form.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          className={field}
          rows={2}
          maxLength={500}
        />
      </label>

      <p className="text-osrs-parchment-dark/60 text-xs">
        Screenshot/video proof upload (B2 presign) lands in a later iteration (FRONTEND_PLAN.md §12).
      </p>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !form.player_id}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Submit"}
        </button>
        {result && <span className="text-osrs-green text-sm">{result}</span>}
      </div>
    </form>
  );
}
