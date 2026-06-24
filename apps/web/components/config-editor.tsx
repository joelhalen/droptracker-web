"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CONFIG_CATEGORIES,
  GROUP_CONFIG_FIELDS,
  type ConfigField,
} from "@droptracker/api-types";
import { saveGroupConfig } from "@/app/(admin)/groups/[id]/settings/actions";

type ConfigValue = string | number | boolean | null;
type ConfigMap = Record<string, ConfigValue>;

export function ConfigEditor({ groupId, initial }: { groupId: number; initial: ConfigMap }) {
  const [values, setValues] = useState<ConfigMap>(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  // Only send keys whose value changed (FRONTEND_PLAN.md §11.2 bulk upsert).
  const changed = useMemo(() => {
    const patch: ConfigMap = {};
    for (const f of GROUP_CONFIG_FIELDS) {
      const v = values[f.key] ?? null;
      if (v !== (initial[f.key] ?? null)) patch[f.key] = v;
    }
    return patch;
  }, [values, initial]);

  const dirtyCount = Object.keys(changed).length;

  const set = (key: string, v: ConfigValue) => setValues((s) => ({ ...s, [key]: v }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirtyCount) return;
    startTransition(async () => {
      await saveGroupConfig(groupId, changed);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      // Adopt the saved values as the new baseline.
      Object.assign(initial, changed);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-10">
      {CONFIG_CATEGORIES.map((cat) => {
        const fields = GROUP_CONFIG_FIELDS.filter((f) => f.category === cat.id);
        if (!fields.length) return null;
        return (
          <fieldset key={cat.id}>
            <legend className="heading-rule text-osrs-gold mb-4 w-full pb-1 text-lg font-semibold">
              {cat.label}
            </legend>
            <div className="space-y-4">
              {fields.map((f) => (
                <Field key={f.key} field={f} value={values[f.key] ?? f.default} onChange={(v) => set(f.key, v)} />
              ))}
            </div>
          </fieldset>
        );
      })}

      <div className="bg-osrs-brown-dark/80 border-osrs-bronze/30 sticky bottom-0 flex items-center gap-3 border-t py-3">
        <button
          type="submit"
          disabled={!dirtyCount || pending}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Saving…" : `Save ${dirtyCount || ""} change${dirtyCount === 1 ? "" : "s"}`.trim()}
        </button>
        {saved && <span className="text-osrs-green text-sm">Saved.</span>}
      </div>
    </form>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: ConfigValue;
  onChange: (v: ConfigValue) => void;
}) {
  const input =
    "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-1.5 text-sm outline-none";

  if (field.type === "boolean") {
    return (
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 size-4"
        />
        <span>
          <span className="block text-sm font-medium">{field.label}</span>
          <span className="text-osrs-parchment-dark/60 block text-xs">{field.help}</span>
        </span>
      </label>
    );
  }

  return (
    <label className="block">
      <span className="block text-sm font-medium">{field.label}</span>
      <span className="text-osrs-parchment-dark/60 mb-1 block text-xs">{field.help}</span>
      {field.type === "select" ? (
        <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={input}>
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
          className={`${input} w-full`}
          rows={2}
        />
      ) : field.type === "int" ? (
        <input
          type="number"
          min={field.min}
          max={field.max}
          value={value == null ? "" : Number(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className={input}
        />
      ) : (
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={`${input} w-full`}
          placeholder={field.type === "channel" ? "Discord channel id" : field.type === "csv" ? "comma,separated" : ""}
        />
      )}
    </label>
  );
}
