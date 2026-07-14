"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { AdminDataList, AdminDataRow } from "@/lib/api";
import { fetchRecord, saveRecord } from "@/app/(site)/(admin)/admin/data/actions";
import { EmptyState } from "@/components/ui";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";

/** Compact display for arbitrary cell values in the table. */
function renderCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  const s = String(value);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

export function DataBrowser({
  data,
  q,
}: {
  data: AdminDataList;
  q: string;
}) {
  const router = useRouter();
  const { entity, columns, rows, editable, meta } = data;
  const [query, setQuery] = useState(q);
  const [selected, setSelected] = useState<AdminDataRow | null>(null);

  const editableSet = new Set(editable);
  const idKey = columns.includes("id") ? "id" : (columns[0] ?? "id");

  const navigate = (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    qs.set("entity", entity);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    router.push(`/admin/data?${qs}` as Route);
  };

  const totalPages = Math.max(1, Math.ceil(meta.total / Math.max(1, meta.limit)));

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ q: query.trim(), page: 1 });
        }}
        className="flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${entity}…`}
          aria-label={`Search ${entity}`}
          className={`${field} flex-1`}
        />
        <button
          type="submit"
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium"
        >
          Search
        </button>
        {q && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              navigate({ q: "", page: 1 });
            }}
            className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-2 text-sm"
          >
            Clear
          </button>
        )}
      </form>

      {columns.length === 0 ? (
        <EmptyState title="No data available for this entity" />
      ) : rows.length === 0 ? (
        <EmptyState title={q ? `No rows match "${q}"` : "No rows in this view"} />
      ) : (
        <div className="border-osrs-bronze/20 overflow-x-auto rounded border">
          <table className="w-full text-left text-sm">
            <thead className="bg-osrs-brown-dark/60 text-osrs-parchment-dark/70">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">
                    {c}
                  </th>
                ))}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-osrs-bronze/15 divide-y">
              {rows.map((row, i) => (
                <tr key={String(row[idKey] ?? i)} className="hover:bg-osrs-bronze/10">
                  {columns.map((c) => (
                    <td key={c} className="max-w-xs truncate px-3 py-2 tabular-nums">
                      {renderCell(row[c])}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setSelected(row)}
                      className="text-osrs-gold-bright hover:underline"
                    >
                      {editable.length > 0 ? "Edit" : "View"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <div className="text-osrs-parchment-dark/60 flex items-center justify-between text-sm">
          <span>
            Page {meta.page} of {totalPages} · {meta.total} total
          </span>
          <div className="flex gap-2">
            <button
              disabled={meta.page <= 1}
              onClick={() => navigate({ q, page: meta.page - 1 })}
              className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={meta.page >= totalPages}
              onClick={() => navigate({ q, page: meta.page + 1 })}
              className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selected && (
        <RecordDrawer
          entity={entity}
          id={selected[idKey] as string | number}
          editableHint={editableSet}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function RecordDrawer({
  entity,
  id,
  editableHint,
  onClose,
  onSaved,
}: {
  entity: string;
  id: string | number;
  editableHint: Set<string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [record, setRecord] = useState<AdminDataRow | null>(null);
  const [editable, setEditable] = useState<string[]>([]);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [loadPending, startLoad] = useTransition();
  const [savePending, startSave] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  // A one-shot fetch must live in an effect, not a state-setting call directly
  // in the render body: React doesn't guarantee a transition's pending flag
  // flips synchronously before the next render re-enters the same branch, so
  // a `!loadPending` guard alone doesn't reliably prevent re-firing (proved
  // out as a real, reproducible request loop in the docs-manager.tsx sibling
  // of this exact pattern). Depends on `[entity, id]`, not `[]`: the parent
  // renders this drawer without a `key`, so selecting a different row reuses
  // this same component instance with new props rather than remounting it.
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setError(null);
    startLoad(async () => {
      try {
        const res = await fetchRecord(entity, id);
        if (!active) return;
        setRecord(res.record);
        // Prefer server-declared editable fields; fall back to list-level hint.
        setEditable(res.editable.length ? res.editable : [...editableHint]);
        setForm(res.record);
        setLoaded(true);
      } catch (e) {
        if (active) {
          setError((e as Error).message || "Failed to load record.");
          setLoaded(true);
        }
      }
    });
    return () => {
      active = false;
    };
    // editableHint deliberately omitted: it's derived from `entity` (already a
    // dep) and is a new Set reference on every parent render, so including it
    // would re-run this effect on every render instead of only on selection
    // change.
  }, [entity, id]);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const onSave = () =>
    startSave(async () => {
      setError(null);
      try {
        const fields: Record<string, unknown> = {};
        for (const k of editable) fields[k] = form[k];
        await saveRecord(entity, id, fields);
        setSavedOk(true);
        setTimeout(onSaved, 600);
      } catch (e) {
        setError((e as Error).message || "Failed to save.");
        setConfirming(false);
      }
    });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="bg-osrs-brown-dark border-osrs-bronze/40 h-full w-full max-w-md overflow-y-auto border-l p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-osrs-gold font-semibold">
            {entity} · #{String(id)}
          </h3>
          <button
            onClick={onClose}
            className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm"
          >
            Close
          </button>
        </div>

        {loadPending || !loaded ? (
          <p className="text-osrs-parchment-dark/60 text-sm">Loading…</p>
        ) : error && !record ? (
          <p className="text-osrs-red text-sm">{error}</p>
        ) : record ? (
          <div className="space-y-4">
            {editable.length === 0 && (
              <p className="text-osrs-parchment-dark/60 text-sm">
                This record is read-only. No fields can be edited.
              </p>
            )}

            {editable.map((k) => {
              const original = record[k];
              if (typeof original === "boolean") {
                return (
                  <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(form[k])}
                      onChange={(e) => set(k, e.target.checked)}
                      className="size-4"
                    />
                    <span className="font-medium">{k}</span>
                  </label>
                );
              }
              if (typeof original === "number") {
                return (
                  <label key={k} className="block">
                    <span className="mb-1 block text-sm font-medium">{k}</span>
                    <input
                      type="number"
                      value={form[k] == null ? "" : String(form[k])}
                      onChange={(e) =>
                        set(k, e.target.value === "" ? null : Number(e.target.value))
                      }
                      className={field}
                    />
                  </label>
                );
              }
              return (
                <label key={k} className="block">
                  <span className="mb-1 block text-sm font-medium">{k}</span>
                  <textarea
                    value={form[k] == null ? "" : String(form[k])}
                    onChange={(e) => set(k, e.target.value)}
                    rows={2}
                    className={field}
                  />
                </label>
              );
            })}

            {/* Read-only fields for context */}
            <details className="text-sm">
              <summary className="text-osrs-parchment-dark/60 cursor-pointer">
                All fields (read-only)
              </summary>
              <dl className="mt-2 space-y-1">
                {Object.entries(record).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-osrs-parchment-dark/50">{k}</dt>
                    <dd className="max-w-[60%] truncate text-right tabular-nums">{renderCell(v)}</dd>
                  </div>
                ))}
              </dl>
            </details>

            {error && <p className="text-osrs-red text-sm">{error}</p>}
            {savedOk && <p className="text-osrs-green text-sm">Saved.</p>}

            {editable.length > 0 && !savedOk && (
              <div className="flex items-center gap-2">
                {confirming ? (
                  <>
                    <button
                      onClick={onSave}
                      disabled={savePending}
                      className="bg-osrs-red/80 text-osrs-parchment hover:bg-osrs-red rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
                    >
                      {savePending ? "Saving…" : "Confirm save"}
                    </button>
                    <button
                      onClick={() => setConfirming(false)}
                      disabled={savePending}
                      className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirming(true)}
                    className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium"
                  >
                    Save changes
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
