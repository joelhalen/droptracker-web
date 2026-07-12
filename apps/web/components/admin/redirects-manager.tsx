"use client";

import { useState, useTransition } from "react";
import { EmptyState, Alert } from "@/components/ui";
import { isExternalDestination, type Redirect, type RedirectInput } from "@/lib/redirects";
import { isValidSource } from "@/lib/redirect-resolver";
import { createRedirect, deleteRedirect, updateRedirect } from "@/app/(admin)/admin/redirects/actions";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";

const blankDraft = (): RedirectInput => ({
  source: "",
  destination: "",
  permanent: false,
  enabled: true,
  order: 100,
  forward_query: true,
  note: null,
});

const toDraft = (r: Redirect): RedirectInput => ({
  source: r.source,
  destination: r.destination,
  permanent: r.permanent,
  enabled: r.enabled,
  order: r.order,
  forward_query: r.forward_query,
  note: r.note,
});

export function RedirectsManager({ redirects }: { redirects: Redirect[] }) {
  const [list, setList] = useState(redirects);
  // `null` = closed, `"new"` = create form, number = editing that id.
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const doDelete = (id: number) => {
    startTransition(async () => {
      setError(null);
      try {
        await deleteRedirect(id);
        setList((l) => l.filter((r) => r.id !== id));
        setConfirmDeleteId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete this redirect.");
        setConfirmDeleteId(null);
      }
    });
  };

  const editingRow = typeof editing === "number" ? list.find((r) => r.id === editing) : undefined;

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex justify-end">
        <button
          onClick={() => setEditing("new")}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium"
        >
          + New redirect
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState title="No redirects yet" hint="Add one to route a path somewhere else." />
      ) : (
        <ul className="divide-osrs-bronze/20 divide-y">
          {list.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="text-osrs-gold-bright">{r.source}</code>
                  <span className="text-osrs-parchment-dark/50">→</span>
                  <code className="truncate">{r.destination}</code>
                </div>
                <div className="text-osrs-parchment-dark/50 mt-1 flex flex-wrap gap-2 text-xs">
                  <span>{r.permanent ? "308 permanent" : "307 temporary"}</span>
                  <span>· order {r.order}</span>
                  {!r.forward_query && <span>· query dropped</span>}
                  {isExternalDestination(r.destination) && <span>· external</span>}
                  {!r.enabled && <span className="text-osrs-red">· disabled</span>}
                  {r.note && <span className="italic">· {r.note}</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs">
                <button
                  onClick={() => setEditing(r.id)}
                  className="text-osrs-gold-bright hover:underline"
                >
                  Edit
                </button>
                {confirmDeleteId === r.id ? (
                  <>
                    <button
                      onClick={() => doDelete(r.id)}
                      disabled={pending}
                      className="text-osrs-red font-medium disabled:opacity-50"
                    >
                      {pending ? "…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={pending}
                      className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(r.id)}
                    className="text-osrs-parchment-dark/60 hover:text-osrs-red"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing != null && (
        <RedirectForm
          key={editing}
          initial={editing === "new" ? blankDraft() : editingRow ? toDraft(editingRow) : blankDraft()}
          id={typeof editing === "number" ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setList((l) => {
              const exists = l.some((r) => r.id === saved.id);
              return exists ? l.map((r) => (r.id === saved.id ? saved : r)) : [...l, saved];
            });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function RedirectForm({
  initial,
  id,
  onClose,
  onSaved,
}: {
  initial: RedirectInput;
  id: number | null;
  onClose: () => void;
  onSaved: (redirect: Redirect) => void;
}) {
  const isNew = id === null;
  const [draft, setDraft] = useState<RedirectInput>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof RedirectInput>(k: K, v: RedirectInput[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const source = draft.source.trim();
  const destination = draft.destination.trim();
  const sourceOk = source !== "" && isValidSource(source);
  const destOk = destination !== "" && (destination.startsWith("/") || isExternalDestination(destination));
  const distinct = source !== destination;
  const canSave = sourceOk && destOk && distinct && !pending;

  const onSave = () =>
    startTransition(async () => {
      setError(null);
      try {
        const payload: RedirectInput = { ...draft, source, destination, note: draft.note?.trim() || null };
        const saved = isNew ? await createRedirect(payload) : await updateRedirect(id!, payload);
        onSaved(saved);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save this redirect.");
      }
    });

  return (
    <div className="border-osrs-gold/40 space-y-4 rounded border p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-osrs-gold font-semibold">{isNew ? "New redirect" : "Edit redirect"}</h3>
        <button onClick={onClose} className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright">
          Close
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Source path</span>
          <input
            value={draft.source}
            onChange={(e) => set("source", e.target.value)}
            placeholder="/wiki"
            className={field}
          />
          <span className="text-osrs-parchment-dark/50 mt-1 block text-xs">
            {source === "" ? (
              "path-to-regexp pattern, e.g. /players/view/:id(\\d+)"
            ) : sourceOk ? (
              <span className="text-osrs-green">Valid pattern.</span>
            ) : (
              <span className="text-osrs-red">Must start with “/” and be a valid path pattern.</span>
            )}
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Destination</span>
          <input
            value={draft.destination}
            onChange={(e) => set("destination", e.target.value)}
            placeholder="/docs or https://runelite.net"
            className={field}
          />
          <span className="text-osrs-parchment-dark/50 mt-1 block text-xs">
            {destination === "" ? (
              "Internal path or external http(s):// URL. Reuse :params from the source."
            ) : destOk ? (
              isExternalDestination(destination) ? (
                <span className="text-osrs-green">External URL.</span>
              ) : (
                <span className="text-osrs-green">Internal path.</span>
              )
            ) : (
              <span className="text-osrs-red">Must be “/…” or an http(s):// URL.</span>
            )}
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Order (lower matches first)</span>
          <input
            type="number"
            value={draft.order}
            onChange={(e) => set("order", Number(e.target.value) || 0)}
            className={field}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Note (optional)</span>
          <input
            value={draft.note ?? ""}
            onChange={(e) => set("note", e.target.value || null)}
            placeholder="Why this redirect exists"
            className={field}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.permanent}
            onChange={(e) => set("permanent", e.target.checked)}
          />
          <span>
            Permanent (308){" "}
            <span className="text-osrs-parchment-dark/50">— browsers cache it; use for stable moves</span>
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.forward_query}
            onChange={(e) => set("forward_query", e.target.checked)}
          />
          <span>Forward query string</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => set("enabled", e.target.checked)}
          />
          <span>Enabled</span>
        </label>
      </div>

      {source !== "" && destination !== "" && !distinct && (
        <Alert variant="error">Source and destination must differ.</Alert>
      )}
      {error && <Alert variant="error">{error}</Alert>}

      <button
        onClick={onSave}
        disabled={!canSave}
        className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save redirect"}
      </button>
    </div>
  );
}
