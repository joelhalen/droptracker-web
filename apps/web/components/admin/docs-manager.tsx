"use client";

import { useEffect, useState, useTransition } from "react";
import type { DocInput, DocSummary } from "@droptracker/api-types";
import { groupDocsByCategory } from "@/lib/docs";
import { Markdown } from "@/components/markdown";
import { EmptyState, Alert } from "@/components/ui";
import { createDoc, deleteDoc, getDocForEdit, updateDoc } from "@/app/(site)/(admin)/admin/docs/actions";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";

const blankDraft = (): DocInput => ({
  slug: "",
  title: "",
  description: null,
  category: "General",
  order: 100,
  content: "",
});

export function DocsManager({ docs }: { docs: DocSummary[] }) {
  const [list, setList] = useState(docs);
  const [editingSlug, setEditingSlug] = useState<string | null | "new">(null);
  const [confirmDeleteSlug, setConfirmDeleteSlug] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const groups = groupDocsByCategory(list);

  const doDelete = (slug: string) => {
    startTransition(async () => {
      setError(null);
      try {
        await deleteDoc(slug);
        setList((l) => l.filter((d) => d.slug !== slug));
        setConfirmDeleteSlug(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete the doc page.");
        setConfirmDeleteSlug(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex justify-end">
        <button
          onClick={() => setEditingSlug("new")}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium"
        >
          + New doc
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState title="No docs pages yet" hint="Create one to populate the public /docs section." />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.category}>
              <h3 className="text-osrs-gold mb-2 text-sm font-semibold">{g.category}</h3>
              <ul className="divide-osrs-bronze/20 divide-y">
                {g.docs.map((d) => (
                  <li key={d.slug} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div>
                      <span className="font-medium">{d.title}</span>
                      <span className="text-osrs-parchment-dark/50 ml-2 text-xs">/docs/{d.slug}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <button
                        onClick={() => setEditingSlug(d.slug)}
                        className="text-osrs-gold-bright hover:underline"
                      >
                        Edit
                      </button>
                      {confirmDeleteSlug === d.slug ? (
                        <>
                          <button
                            onClick={() => doDelete(d.slug)}
                            disabled={pending}
                            className="text-osrs-red font-medium disabled:opacity-50"
                          >
                            {pending ? "…" : "Confirm"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteSlug(null)}
                            disabled={pending}
                            className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteSlug(d.slug)}
                          className="text-osrs-parchment-dark/60 hover:text-osrs-red"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {editingSlug != null && (
        <DocForm
          key={editingSlug}
          slug={editingSlug === "new" ? null : editingSlug}
          onClose={() => setEditingSlug(null)}
          onSaved={(saved, isNew) => {
            setList((l) => {
              if (isNew) return [...l, saved];
              // Editing an existing doc — editingSlug is the pre-save slug here
              // (isNew false means it was never "new"), which may differ from
              // saved.slug if the admin renamed it.
              return l.map((d) => (d.slug === editingSlug ? saved : d));
            });
            setEditingSlug(null);
          }}
        />
      )}
    </div>
  );
}

function DocForm({
  slug,
  onClose,
  onSaved,
}: {
  slug: string | null;
  onClose: () => void;
  onSaved: (doc: DocSummary, isNew: boolean) => void;
}) {
  const isNew = slug === null;
  const [draft, setDraft] = useState<DocInput>(blankDraft());
  const [loaded, setLoaded] = useState(isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Fetch the full doc (list only carries summaries) once, when editing an
  // existing page. A plain `useEffect` — not a state-setting call directly in
  // the render body — is the only reliable way to run a one-shot effect:
  // calling `startTransition`/`setState` unconditionally during render is a
  // side effect during render, and React does not guarantee a transition's
  // `isPending` flips synchronously before the next render can re-enter the
  // same code path. A guard on `isPending` narrows that race but doesn't
  // close it — this surfaced as a real, reproducible ~50ms request loop, not
  // just a theoretical concern.
  useEffect(() => {
    if (isNew) return;
    let active = true;
    startTransition(async () => {
      try {
        const doc = await getDocForEdit(slug!);
        if (!active) return;
        if (doc) setDraft({ ...doc, description: doc.description ?? null });
        else setLoadError("Doc not found.");
      } catch {
        if (active) setLoadError("Couldn't load this doc page.");
      } finally {
        if (active) setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
    // slug/isNew are fixed for the lifetime of this form instance (the parent
    // remounts a fresh DocForm via `key={editingSlug}` rather than updating
    // props in place), so an empty dependency array is intentional here.
  }, []);

  const set = <K extends keyof DocInput>(k: K, v: DocInput[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const onSave = () =>
    startTransition(async () => {
      setError(null);
      try {
        if (isNew) {
          await createDoc(draft);
        } else {
          await updateDoc(slug!, draft);
        }
        onSaved(
          {
            slug: draft.slug,
            title: draft.title,
            description: draft.description ?? null,
            category: draft.category,
            order: draft.order,
          },
          isNew,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save this doc page.");
      }
    });

  return (
    <div className="border-osrs-gold/40 space-y-4 rounded border p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-osrs-gold font-semibold">{isNew ? "New doc page" : `Edit ${slug}`}</h3>
        <button onClick={onClose} className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright">
          Close
        </button>
      </div>

      {!loaded ? (
        <p className="text-osrs-parchment-dark/60 text-sm">Loading…</p>
      ) : loadError ? (
        <p className="text-osrs-red text-sm">{loadError}</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Slug</span>
              <input
                value={draft.slug}
                onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))}
                placeholder="getting-started"
                className={field}
              />
              <span className="text-osrs-parchment-dark/50 mt-1 block text-xs">
                URL: /docs/{draft.slug || "…"}
                {!isNew && " — changing this breaks existing links to the old URL."}
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Title</span>
              <input value={draft.title} onChange={(e) => set("title", e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Category</span>
              <input value={draft.category} onChange={(e) => set("category", e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Order (within category)</span>
              <input
                type="number"
                value={draft.order}
                onChange={(e) => set("order", Number(e.target.value) || 0)}
                className={field}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Description (optional)</span>
            <input
              value={draft.description ?? ""}
              onChange={(e) => set("description", e.target.value || null)}
              placeholder="Shown in the docs index and search snippets."
              className={field}
            />
          </label>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium">Content (Markdown)</span>
              <button
                type="button"
                onClick={() => setPreview((p) => !p)}
                className="text-osrs-parchment-dark/70 text-xs hover:text-osrs-gold-bright"
              >
                {preview ? "Edit" : "Preview"}
              </button>
            </div>
            {preview ? (
              <div className="border-osrs-bronze/30 min-h-[12rem] rounded border p-4">
                <Markdown>{draft.content || "*Nothing to preview.*"}</Markdown>
              </div>
            ) : (
              <textarea
                value={draft.content}
                onChange={(e) => set("content", e.target.value)}
                rows={14}
                className={`${field} font-mono`}
              />
            )}
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          <button
            onClick={onSave}
            disabled={pending || !draft.slug.trim() || !draft.title.trim() || !draft.content.trim()}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save doc page"}
          </button>
        </>
      )}
    </div>
  );
}
