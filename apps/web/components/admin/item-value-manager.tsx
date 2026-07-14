"use client";

import { useEffect, useState, useTransition } from "react";
import type {
  ItemValueOverride,
  ItemValueOverrideInput,
  ItemValueComponent,
  ItemSearchResult,
} from "@droptracker/api-types";
import { Badge } from "@/components/ui";
import { ItemDbIcon } from "@/components/item-db-icon";
import { deleteItemValue, saveItemValue, searchItems } from "@/app/(site)/(admin)/admin/item-values/actions";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/60 text-osrs-parchment placeholder:text-osrs-parchment-dark/50 focus:border-osrs-gold block w-full min-w-0 rounded border px-3 py-2.5 text-base outline-none";

const help =
  "text-osrs-parchment-dark/55 mt-1 block text-xs leading-relaxed";

const blankOverride = (): ItemValueOverride => ({
  id: 0,
  item_id: null,
  item_name: "",
  divisor: 1,
  flat_bonus: 0,
  fallback_value: 0,
  components: [],
  description: "",
  active: true,
});

/** Human-readable formula, e.g. "Abyssal bludgeon ÷ 3" or "Ultor ring − 3 × Chromium ingot". */
function formulaText(o: {
  components: ItemValueComponent[];
  flat_bonus: number;
  divisor: number;
  fallback_value: number;
}): string {
  const terms = o.components
    .filter((c) => (c.item_name || "").trim())
    .map((c, i) => {
      const mag = Math.abs(c.quantity);
      const piece = mag === 1 ? c.item_name : `${mag} × ${c.item_name}`;
      if (i === 0) return c.quantity < 0 ? `−${piece}` : piece;
      return `${c.quantity < 0 ? "−" : "+"} ${piece}`;
    });
  let expr = terms.join(" ") || "0";
  if (o.flat_bonus) expr += ` ${o.flat_bonus < 0 ? "−" : "+"} ${Math.abs(o.flat_bonus).toLocaleString()}`;
  if (o.divisor !== 1) {
    const parens = terms.length > 1 || o.flat_bonus !== 0;
    expr = parens ? `(${expr}) ÷ ${o.divisor}` : `${expr} ÷ ${o.divisor}`;
  }
  if (o.fallback_value) expr += `, else ${o.fallback_value.toLocaleString()} gp`;
  return expr;
}

export function ItemValueManager({
  overrides,
  exportTxt,
}: {
  overrides: ItemValueOverride[];
  exportTxt: string;
}) {
  const [editing, setEditing] = useState<{ override: ItemValueOverride; isNew: boolean } | null>(null);

  return (
    <div className="space-y-8">
      <section className="min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-osrs-gold text-lg font-semibold">Overrides</h2>
          <button
            onClick={() => setEditing({ override: blankOverride(), isNew: true })}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium"
          >
            + New override
          </button>
        </div>

        {editing && (
          <ItemValueForm
            key={editing.override.id || "new"}
            override={editing.override}
            isNew={editing.isNew}
            onClose={() => setEditing(null)}
          />
        )}

        <ul className="divide-osrs-bronze/20 divide-y">
          {overrides.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ItemDbIcon itemId={o.item_id} size={24} />
                  <span className="font-medium">{o.item_name}</span>
                  {o.item_id != null && (
                    <span className="text-osrs-parchment-dark/50 text-xs">#{o.item_id}</span>
                  )}
                  {!o.active && <Badge tone="red">Inactive</Badge>}
                </div>
                <div className="text-osrs-parchment-dark/60 text-xs">
                  {o.description || formulaText(o)}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-osrs-gold-bright tabular-nums">
                  {o.computed_value != null ? `${o.computed_value.toLocaleString()} gp` : "—"}
                </span>
                <button
                  onClick={() => setEditing({ override: o, isNew: false })}
                  className="text-osrs-gold-bright hover:underline"
                >
                  Edit
                </button>
              </div>
            </li>
          ))}
          {!overrides.length && (
            <li className="text-osrs-parchment-dark/60 py-3 text-sm">
              No overrides yet. Run <code>scripts/seed_item_value_overrides.py</code> to seed the
              built-in rules, or add one above.
            </li>
          )}
        </ul>
      </section>

      <ExportPanel txt={exportTxt} />
    </div>
  );
}

function ItemValueForm({
  override,
  isNew,
  onClose,
}: {
  override: ItemValueOverride;
  isNew: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ItemValueOverride>(override);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof ItemValueOverride>(k: K, v: ItemValueOverride[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setComponent = (i: number, patch: Partial<ItemValueComponent>) =>
    setForm((f) => ({
      ...f,
      components: f.components.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    }));

  const addComponent = () =>
    setForm((f) => ({ ...f, components: [...f.components, { item_id: null, item_name: "", quantity: 1 }] }));

  const removeComponent = (i: number) =>
    setForm((f) => ({ ...f, components: f.components.filter((_, j) => j !== i) }));

  const onSave = () =>
    startTransition(async () => {
      setError(null);
      const input: ItemValueOverrideInput = {
        item_id: form.item_id ?? null,
        item_name: form.item_name.trim(),
        divisor: form.divisor,
        flat_bonus: form.flat_bonus,
        fallback_value: form.fallback_value,
        components: form.components
          .filter((c) => (c.item_name || "").trim() && c.quantity !== 0)
          .map((c) => ({
            item_id: c.item_id ?? null,
            item_name: c.item_name.trim(),
            quantity: c.quantity,
          })),
        description: (form.description || "").trim() || undefined,
        active: form.active,
      };
      const res = await saveItemValue(input, isNew ? undefined : form.id);
      if ("error" in res && res.error) setError(res.error);
      else onClose();
    });

  const onDelete = () =>
    startTransition(async () => {
      setError(null);
      const res = await deleteItemValue(form.id);
      if ("error" in res && res.error) setError(res.error);
      else onClose();
    });

  return (
    <div className="border-osrs-gold/40 w-full min-w-0 space-y-6 rounded border p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-osrs-gold font-semibold">
          {isNew ? (
            "New override"
          ) : (
            <span className="inline-flex items-center gap-2">
              <ItemDbIcon itemId={override.item_id} size={22} />
              Edit {override.item_name}
            </span>
          )}
        </h3>
        <button
          onClick={onClose}
          className="text-osrs-parchment-dark/60 shrink-0 text-sm hover:text-osrs-gold-bright"
        >
          Close
        </button>
      </div>

      <p className={help}>
        When a player submits this item at 0&nbsp;gp, DropTracker replaces the value with:{" "}
        <strong className="text-osrs-parchment-dark/80 font-normal">
          (sum of each component&apos;s live GE price × quantity, plus flat bonus) ÷ divisor
        </strong>
        . If any component cannot be priced, the fallback gp value is used instead.
      </p>

      <label className="block w-full">
        <span className="mb-1 block text-sm font-medium">Target item</span>
        <p className={`${help} mb-2`}>
          The dropped item this rule applies to. Search by name and pick a result so we store the
          correct item id.
        </p>
        <ItemPicker
          value={form.item_name}
          itemId={form.item_id}
          onPick={(item) => setForm((f) => ({ ...f, item_id: item.item_id, item_name: item.item_name }))}
          placeholder="Search e.g. Bludgeon axon, Ultor vestige…"
        />
        {form.item_id != null && (
          <p className={help}>Item id #{form.item_id} will be saved with this override.</p>
        )}
      </label>

      <div className="space-y-3">
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">Components</span>
            <button
              type="button"
              onClick={addComponent}
              className="text-osrs-gold-bright text-sm hover:underline"
            >
              + Add component
            </button>
          </div>
          <p className={help}>
            Each row is another item whose <em>current Grand Exchange price</em> feeds the formula.
            Use a positive quantity to add (e.g. +1 × Abyssal bludgeon) or negative to subtract
            (e.g. −1 × Amulet of torture, −3 × Chromium ingot).
          </p>
        </div>

        {form.components.map((c, i) => (
          <div
            key={i}
            className="border-osrs-bronze/25 bg-osrs-brown-dark/20 space-y-3 rounded border p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-osrs-parchment-dark/70 text-xs font-medium uppercase tracking-wide">
                Component {i + 1}
              </span>
              <button
                type="button"
                onClick={() => removeComponent(i)}
                className="text-osrs-red text-xs hover:underline"
              >
                Remove
              </button>
            </div>
            <label className="block w-full">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Item name</span>
              <ItemPicker
                value={c.item_name}
                itemId={c.item_id}
                onPick={(item) => setComponent(i, { item_id: item.item_id, item_name: item.item_name })}
                placeholder="Search component item…"
              />
            </label>
            <label className="block max-w-[10rem]">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Quantity</span>
              <input
                type="number"
                value={c.quantity}
                onChange={(e) => setComponent(i, { quantity: parseInt(e.target.value, 10) || 0 })}
                className={field}
              />
              <span className={help}>
                {c.quantity < 0
                  ? "Subtracts this item's GE price from the total."
                  : c.quantity > 1
                    ? `Adds ${c.quantity}× this item's GE price.`
                    : "Adds this item's GE price once."}
              </span>
            </label>
          </div>
        ))}

        {!form.components.length && (
          <p className="text-osrs-parchment-dark/50 border-osrs-bronze/20 rounded border border-dashed px-3 py-4 text-sm">
            No components yet — add at least one priced item, or leave empty and rely on the fallback
            value below (fixed gp).
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Divisor</span>
          <input
            type="number"
            min={1}
            value={form.divisor}
            onChange={(e) => set("divisor", Math.max(1, parseInt(e.target.value, 10) || 1))}
            className={field}
          />
          <span className={help}>
            Divide the component total by this number. Use 3 for &ldquo;one third of&rdquo; rules; leave
            at 1 when no division is needed.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Flat bonus (gp)</span>
          <input
            type="number"
            value={form.flat_bonus}
            onChange={(e) => set("flat_bonus", parseInt(e.target.value, 10) || 0)}
            className={field}
          />
          <span className={help}>
            Optional fixed gp added after summing components, before dividing. Usually 0.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Fallback value (gp)</span>
          <input
            type="number"
            min={0}
            value={form.fallback_value}
            onChange={(e) => set("fallback_value", Math.max(0, parseInt(e.target.value, 10) || 0))}
            className={field}
          />
          <span className={help}>
            Used when a component&apos;s GE price is missing. Set to 0 to keep the client&apos;s
            submitted value instead.
          </span>
        </label>
      </div>

      <label className="block w-full">
        <span className="mb-1 block text-sm font-medium">Public description</span>
        <input
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          placeholder="e.g. One third of an Abyssal bludgeon."
          className={field}
        />
        <span className={help}>
          Plain-language explanation on the{" "}
          <a href="/item-values" className="text-osrs-gold-bright hover:underline">
            /item-values
          </a>{" "}
          page. The formula preview below is shown when this is empty.
        </span>
      </label>

      <div className="border-osrs-bronze/30 bg-osrs-brown-dark/30 rounded border p-3 text-sm">
        <span className="text-osrs-parchment-dark/60 block text-xs font-medium uppercase tracking-wide">
          Formula preview
        </span>
        <span className="text-osrs-parchment mt-1 block">{formulaText(form)}</span>
      </div>

      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => set("active", e.target.checked)}
          className="mt-0.5 size-4 shrink-0"
        />
        <span>
          Active
          <span className={help}>
            When checked, this rule is applied to incoming drops and listed publicly. Uncheck to
            disable without deleting.
          </span>
        </span>
      </label>

      {error && <p className="text-osrs-red text-sm">{error}</p>}

      <div className="flex items-center justify-between">
        <button
          onClick={onSave}
          disabled={pending || !form.item_name.trim()}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save override"}
        </button>
        {!isNew && (
          <button
            onClick={onDelete}
            disabled={pending}
            className="text-osrs-red text-sm hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

/** Debounced item name → id search with a suggestions dropdown. */
function ItemPicker({
  value,
  itemId,
  onPick,
  placeholder,
}: {
  value: string;
  itemId?: number | null;
  onPick: (item: { item_id: number | null; item_name: string }) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<ItemSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    if (query.trim().length < 2 || query === value) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await searchItems(query);
        setResults(res);
        setOpen(true);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, value]);

  return (
    <div className="relative w-full min-w-0">
      <div className="relative">
        {itemId != null && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2"
          >
            <ItemDbIcon itemId={itemId} size={22} />
          </span>
        )}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onPick({ item_id: null, item_name: e.target.value });
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className={itemId != null ? `${field} pl-11` : field}
        />
        {open && results.length > 0 && (
          <ul className="border-osrs-bronze/40 bg-osrs-brown-dark absolute top-full z-20 mt-1 max-h-56 w-full min-w-[16rem] overflow-auto rounded border shadow-lg">
            {results.map((r) => (
              <li key={r.item_id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onPick(r);
                    setQuery(r.item_name);
                    setOpen(false);
                  }}
                  className="hover:bg-osrs-bronze/30 flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                >
                  <span className="text-osrs-parchment flex min-w-0 items-center gap-2">
                    <ItemDbIcon itemId={r.item_id} size={20} />
                    <span className="truncate">{r.item_name}</span>
                  </span>
                  <span className="text-osrs-parchment-dark/50 ml-2 shrink-0 text-xs">
                    #{r.item_id}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ExportPanel({ txt }: { txt: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="border-osrs-bronze/20 space-y-2 border-t pt-6">
      <h2 className="text-osrs-gold text-lg font-semibold">Plugin valued-items list</h2>
      <p className="text-osrs-parchment-dark/70 text-sm">
        The <code>/value_mods</code> endpoint already serves this live. To update the GitHub Pages
        <code> content/valued_items.txt</code> the plugin reads, copy the list below and commit it.
      </p>
      <textarea readOnly value={txt} rows={2} className={`${field} font-mono`} />
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(txt);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable */
          }
        }}
        className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium"
      >
        {copied ? "Copied!" : "Copy list"}
      </button>
    </section>
  );
}
