"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CONFIG_CATEGORIES,
  GROUP_CONFIG_FIELDS,
  getConfigField,
  type ConfigField,
} from "@droptracker/api-types";
import { saveGroupConfig, fetchGroupDiscordChannels } from "@/app/(admin)/groups/[id]/settings/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";
import { DiscordChannelPicker } from "@/components/discord-channel-picker";
import type { DiscordChannel } from "@/lib/api";

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
  return out;
}

export function ConfigEditor({ groupId, initial }: { groupId: number; initial: ConfigMap }) {
  const normalized = useMemo(() => normalize(initial), [initial]);
  const [baseline, setBaseline] = useState<ConfigMap>(normalized);
  const [values, setValues] = useState<ConfigMap>(normalized);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetched once here (not per-field) since up to 9 fields share this same list.
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  useEffect(() => {
    let active = true;
    fetchGroupDiscordChannels(groupId)
      .then((res) => {
        if (active) setChannels(res.channels);
      })
      .catch(() => {
        /* picker falls back to manual entry when the list is empty */
      });
    return () => {
      active = false;
    };
  }, [groupId]);

  // Only send keys whose value changed (FRONTEND_PLAN.md §11.2 bulk upsert).
  const changed = useMemo(() => {
    const patch: ConfigMap = {};
    for (const f of GROUP_CONFIG_FIELDS) {
      const v = values[f.key] ?? null;
      if (v !== (baseline[f.key] ?? null)) patch[f.key] = v;
    }
    return patch;
  }, [values, baseline]);

  const dirtyCount = Object.keys(changed).length;

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
                <Field
                  key={f.key}
                  field={f}
                  value={values[f.key] ?? f.default}
                  onChange={(v) => set(f.key, v)}
                  channels={channels}
                />
              ))}
            </div>
          </fieldset>
        );
      })}

      <div className="bg-osrs-brown-dark/80 border-osrs-bronze/30 sticky bottom-0 space-y-2 border-t py-3">
        {error && <Alert variant="error">{error}</Alert>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!dirtyCount || pending}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
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
  );
}

function Field({
  field,
  value,
  onChange,
  channels,
}: {
  field: ConfigField;
  value: ConfigValue;
  onChange: (v: ConfigValue) => void;
  channels: DiscordChannel[];
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
      ) : field.type === "channel" ? (
        <DiscordChannelPicker
          channels={channels}
          value={String(value ?? "")}
          onChange={(v) => onChange(v)}
        />
      ) : (
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={`${input} w-full`}
          placeholder={field.type === "csv" ? "comma,separated" : ""}
        />
      )}
    </label>
  );
}
