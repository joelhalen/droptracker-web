"use client";

/**
 * Checkbox list for a `multiselect` config field, such as the slayer masters
 * whose tasks a group's notifications skip. The options are the registry's
 * own, so there is nothing to fetch.
 *
 * The stored value is the chosen option values, comma-separated in option
 * order, with "" meaning none. That is exactly what the backend's
 * coerce_multiselect writes back, so saving without a change never shows up
 * as an edit. "" is a real choice here ("skip nobody"), distinct from the
 * absent row that means the field's default; the backend fills the default in
 * before the editor ever sees the value.
 */
import { formatMultiselect, parseMultiselect, type ConfigField } from "@droptracker/api-types";

export function MultiSelectOptions({
  field,
  value,
  onChange,
  disabled = false,
}: {
  field: ConfigField;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const options = field.options ?? [];
  const chosen = new Set(parseMultiselect(value));

  const toggle = (option: string) => {
    const next = new Set(chosen);
    if (next.has(option)) next.delete(option);
    else next.add(option);
    onChange(formatMultiselect(field, next));
  };

  return (
    <div
      role="group"
      aria-label={field.label}
      className="border-osrs-bronze/20 bg-osrs-surface-2/40 rounded-lg border p-3"
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-osrs-parchment-dark/70 text-xs">
          {chosen.size === 0 ? "None selected" : `${chosen.size} selected`}
        </span>
        {chosen.size > 0 && !disabled && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-xs"
          >
            Clear all
          </button>
        )}
      </div>
      <ul className="grid gap-x-4 sm:grid-cols-2">
        {options.map((option) => {
          const checked = chosen.has(option.value);
          return (
            <li key={option.value}>
              <label className="hover:bg-osrs-bronze/10 flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(option.value)}
                  disabled={disabled}
                  className="accent-osrs-gold shrink-0 disabled:cursor-not-allowed"
                />
                <span className={checked ? "" : "text-osrs-parchment-dark/80"}>{option.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
