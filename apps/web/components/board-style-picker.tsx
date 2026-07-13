"use client";

import { useEffect, useMemo, useState } from "react";
import type { LootboardStyle } from "@/lib/api";
import { fieldInputClass } from "@/components/ui";

/**
 * Preview-driven picker for the `loot_board_type` config key — the return of
 * the legacy XenForo selector's ~80-style catalog. Closed state shows the
 * current style's thumbnail; the modal offers category tabs and a preview
 * grid. Selection only updates the pending config value; the editor's normal
 * Save button persists it.
 *
 * Falls back to a plain numeric input when the catalog hasn't loaded (API
 * down) so the field is never a dead end.
 */

/** Categories are stored lowercase ("halfrounded") — capitalize for display. */
const catLabel = (c: string) => (c ? c.charAt(0).toUpperCase() + c.slice(1) : c);
export function BoardStylePicker({
  styles,
  value,
  onChange,
  disabled = false,
}: {
  styles: LootboardStyle[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Legacy rows store "0"/"" as "unset"; the generator renders style 1 then.
  const effectiveId = value && value !== "0" ? value : "1";
  const current = styles.find((s) => String(s.id) === effectiveId) ?? null;

  if (styles.length === 0) {
    return (
      <input
        type="text"
        inputMode="numeric"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${fieldInputClass} w-full disabled:cursor-not-allowed`}
        placeholder="Style id (catalog unavailable)"
      />
    );
  }

  return (
    <div>
      <div className="border-osrs-bronze/15 bg-osrs-surface-2/50 flex items-center gap-3 rounded-lg border p-2">
        {current ? (
          <img
            src={current.preview_url}
            alt={current.name}
            loading="lazy"
            className="border-osrs-bronze/20 h-14 w-20 shrink-0 rounded border object-cover object-top"
          />
        ) : (
          <div className="border-osrs-bronze/20 bg-osrs-surface-1 text-osrs-parchment-dark/50 flex h-14 w-20 shrink-0 items-center justify-center rounded border text-xs">
            #{effectiveId}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{current ? current.name : `Style ${effectiveId}`}</p>
          {current && <p className="text-osrs-parchment-dark/60 truncate text-xs">{catLabel(current.category)}</p>}
        </div>
        <button
          type="button"
          onClick={() => !disabled && setOpen(true)}
          disabled={disabled}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          Browse styles…
        </button>
      </div>

      {open && (
        <BoardStyleModal
          styles={styles}
          selectedId={effectiveId}
          onSelect={(id) => {
            onChange(String(id));
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function BoardStyleModal({
  styles,
  selectedId,
  onSelect,
  onClose,
}: {
  styles: LootboardStyle[];
  selectedId: string;
  onSelect: (id: number) => void;
  onClose: () => void;
}) {
  const categories = useMemo(
    () => Array.from(new Set(styles.map((s) => s.category))),
    [styles],
  );
  const [category, setCategory] = useState<string>("all");

  const visible = useMemo(
    () => (category === "all" ? styles : styles.filter((s) => s.category === category)),
    [styles, category],
  );

  // Escape closes; body scroll locks while the modal is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Select a lootboard style"
        className="border-osrs-bronze/30 bg-osrs-surface-1 relative flex max-h-[85vh] w-full max-w-5xl flex-col rounded-xl border shadow-2xl"
      >
        <div className="border-osrs-bronze/20 flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h3 className="text-osrs-gold text-lg font-semibold">Select a lootboard style</h3>
            <p className="text-osrs-parchment-dark/60 text-xs">
              {styles.length} styles — click a preview to view it full size, then choose Select.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright rounded px-2 py-1 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="border-osrs-bronze/20 flex flex-wrap gap-1.5 border-b px-5 py-3">
          {["all", ...categories].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                category === cat
                  ? "bg-osrs-bronze text-osrs-parchment"
                  : "bg-osrs-surface-2/60 text-osrs-parchment-dark/70 hover:bg-osrs-surface-2"
              }`}
            >
              {cat === "all" ? `All (${styles.length})` : catLabel(cat)}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((s) => {
              const selected = String(s.id) === selectedId;
              return (
                <div
                  key={s.id}
                  className={`flex flex-col overflow-hidden rounded-lg border transition-colors ${
                    selected
                      ? "border-osrs-gold ring-osrs-gold/40 ring-1"
                      : "border-osrs-bronze/15 hover:border-osrs-gold/40"
                  }`}
                >
                  <a
                    href={s.preview_url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative block"
                    title="Open full-size preview"
                  >
                    <img
                      src={s.preview_url}
                      alt={`${s.name} preview`}
                      loading="lazy"
                      className="aspect-[4/3] w-full bg-black/40 object-cover object-top transition-transform group-hover:scale-[1.02]"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      View full size ↗
                    </span>
                  </a>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{s.name}</p>
                      <span className="bg-osrs-surface-2/60 text-osrs-parchment-dark/60 shrink-0 rounded-full px-2 py-0.5 text-[10px]">
                        {catLabel(s.category)}
                      </span>
                    </div>
                    {s.description && (
                      <p className="text-osrs-parchment-dark/60 line-clamp-2 text-xs">{s.description}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelect(s.id)}
                      className={`mt-auto w-full rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        selected
                          ? "bg-osrs-gold text-osrs-brown-dark"
                          : "bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark"
                      }`}
                    >
                      {selected ? "✓ Selected" : "Select style"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
