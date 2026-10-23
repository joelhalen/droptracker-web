"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import {
  TOOL_SECTIONS,
  type ToolLink,
  type ToolListing,
  type ToolListingInput,
  type ToolSection,
} from "@/lib/tools-directory";
import {
  addToolMaintainer,
  createToolListing,
  deleteToolListing,
  removeToolMaintainer,
  updateToolListing,
} from "@/app/(site)/(public)/tools/actions";
import { searchUsers } from "@/app/(site)/(admin)/admin/users/actions";

type Props = {
  /** Undefined = a new listing (staff only). */
  listing?: ToolListing;
  canAdmin: boolean;
  defaultSection?: ToolSection;
  onSaved: (listing: ToolListing) => void;
  onDeleted: (id: number) => void;
  onCancel: () => void;
};

const selectClass =
  "text-osrs-parchment border-osrs-bronze/40 bg-osrs-surface-2 focus:border-osrs-gold w-full rounded-lg border px-3 py-2 text-sm outline-none";

export function ListingEditor({ listing, canAdmin, defaultSection, onSaved, onDeleted, onCancel }: Props) {
  const [name, setName] = useState(listing?.name ?? "");
  const [summary, setSummary] = useState(listing?.summary ?? "");
  const [details, setDetails] = useState(listing?.details ?? "");
  const [tags, setTags] = useState((listing?.tags ?? []).join(", "));
  const [links, setLinks] = useState<ToolLink[]>(
    listing?.links.length ? listing.links : [{ label: "", href: "" }],
  );
  const [logoUrl, setLogoUrl] = useState(listing?.logo_url ?? "");
  const [accent, setAccent] = useState(listing?.accent ?? "");
  // Staff only:
  const [slug, setSlug] = useState(listing?.slug ?? "");
  const [section, setSection] = useState<ToolSection>(listing?.section ?? defaultSection ?? "events");
  const [fitLabel, setFitLabel] = useState(listing?.fit_label ?? "");
  const [fitNote, setFitNote] = useState(listing?.fit_note ?? "");
  const [sortOrder, setSortOrder] = useState(String(listing?.sort_order ?? 100));
  const [visible, setVisible] = useState(listing?.visible ?? true);

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setLink = (i: number, patch: Partial<ToolLink>) =>
    setLinks((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const save = () => {
    setError(null);
    const payload: ToolListingInput = {
      name: name.trim(),
      summary: summary.trim(),
      details: details.trim() || null,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      links: links
        .map((l) => ({ label: l.label.trim(), href: l.href.trim() }))
        .filter((l) => l.label || l.href),
      logo_url: logoUrl.trim() || null,
      accent: accent.trim() || null,
    };
    if (canAdmin) {
      const order = Number(sortOrder);
      if (!Number.isInteger(order)) {
        setError("Order must be a whole number.");
        return;
      }
      Object.assign(payload, {
        section,
        fit_label: fitLabel.trim() || null,
        fit_note: fitNote.trim() || null,
        sort_order: order,
        visible,
        ...(slug.trim() ? { slug: slug.trim() } : {}),
      });
    }
    startTransition(async () => {
      const res = listing
        ? await updateToolListing(listing.id, payload)
        : await createToolListing(payload);
      if (res.ok) onSaved(res.value);
      else setError(res.error);
    });
  };

  const remove = () => {
    if (!listing || !confirm(`Remove ${listing.name} from the directory?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteToolListing(listing.id);
      if (res.ok) onDeleted(listing.id);
      else setError(res.error);
    });
  };

  return (
    <Card className="space-y-4 md:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-osrs-gold text-lg font-semibold">
          {listing ? `Edit ${listing.name}` : "New listing"}
        </h3>
        {!canAdmin && (
          <span className="text-osrs-parchment-dark/60 text-xs">
            You maintain this listing. Staff look after where it appears.
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name">
          {(p) => <Input {...p} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Tags" hint="Comma separated, up to 8.">
          {(p) => <Input {...p} value={tags} onChange={(e) => setTags(e.target.value)} />}
        </Field>
      </div>

      <Field label="Summary" hint="One or two sentences. Always shown on the card.">
        {(p) => (
          <Textarea {...p} rows={2} value={summary} maxLength={300} onChange={(e) => setSummary(e.target.value)} />
        )}
      </Field>

      <Field label="More detail" hint="Optional. Shown when the card is expanded. Leave a blank line between paragraphs.">
        {(p) => (
          <Textarea {...p} rows={4} value={details} maxLength={2000} onChange={(e) => setDetails(e.target.value)} />
        )}
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-osrs-parchment text-sm font-medium">Links</legend>
        <p className="text-osrs-parchment-dark/60 text-xs">The first link is the main one. Up to 6.</p>
        {links.map((link, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <Input
              aria-label={`Link ${i + 1} label`}
              placeholder="Label"
              value={link.label}
              maxLength={40}
              onChange={(e) => setLink(i, { label: e.target.value })}
              className="w-40"
            />
            <Input
              aria-label={`Link ${i + 1} address`}
              placeholder="https://"
              value={link.href}
              onChange={(e) => setLink(i, { href: e.target.value })}
              className="min-w-0 flex-1"
            />
            <Button
              variant="link"
              size="sm"
              disabled={links.length === 1}
              onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
            >
              Remove
            </Button>
          </div>
        ))}
        {links.length < 6 && (
          <Button variant="ghost" size="xs" onClick={() => setLinks((prev) => [...prev, { label: "", href: "" }])}>
            Add link
          </Button>
        )}
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Logo address" hint="Optional, https only. A letter tile is used without one.">
          {(p) => <Input {...p} value={logoUrl} placeholder="https://" onChange={(e) => setLogoUrl(e.target.value)} />}
        </Field>
        <Field label="Tile colour" hint="Used for the letter tile.">
          {(p) => (
            <div className="flex items-center gap-2">
              <input
                {...p}
                type="color"
                value={accent || "#8b6a3e"}
                onChange={(e) => setAccent(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent"
              />
              <span className="text-osrs-parchment-dark/70 text-sm">{accent || "Default"}</span>
              {accent && (
                <Button variant="link" size="xs" onClick={() => setAccent("")}>
                  Reset
                </Button>
              )}
            </div>
          )}
        </Field>
      </div>

      {canAdmin && (
        <div className="border-osrs-bronze/25 space-y-4 border-t pt-4">
          <div className="text-osrs-parchment-dark/60 text-xs font-semibold uppercase tracking-wide">
            Staff only
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Section">
              {(p) => (
                <select
                  {...p}
                  value={section}
                  onChange={(e) => setSection(e.target.value as ToolSection)}
                  className={selectClass}
                >
                  {TOOL_SECTIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Order" hint="Lower comes first.">
              {(p) => (
                <Input {...p} inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              )}
            </Field>
            <Field label="Slug" hint={listing ? undefined : "Made from the name if left blank."}>
              {(p) => <Input {...p} value={slug} maxLength={64} onChange={(e) => setSlug(e.target.value)} />}
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Fit badge" hint='Short, e.g. "Syncs rosters".'>
              {(p) => <Input {...p} value={fitLabel} maxLength={40} onChange={(e) => setFitLabel(e.target.value)} />}
            </Field>
            <Field label="How it fits with The DropTracker" className="md:col-span-2">
              {(p) => (
                <Textarea {...p} rows={2} value={fitNote} maxLength={400} onChange={(e) => setFitNote(e.target.value)} />
              )}
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
            Shown on the page
          </label>
        </div>
      )}

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button onClick={save} loading={pending} loadingLabel="Saving…">
            Save
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        </div>
        {canAdmin && listing && (
          <Button variant="danger" size="sm" onClick={remove} disabled={pending}>
            Remove listing
          </Button>
        )}
      </div>

      {canAdmin && listing && <MaintainersPanel listing={listing} onChange={onSaved} />}
    </Card>
  );
}

function MaintainersPanel({ listing, onChange }: { listing: ToolListing; onChange: (l: ToolListing) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: number; label: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const maintainers = listing.maintainers ?? [];

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setError(null);
    startTransition(async () => setResults(await searchUsers(term)));
  };

  const act = (fn: () => ReturnType<typeof addToolMaintainer>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        onChange(res.value);
        setResults(null);
        setQ("");
      } else setError(res.error);
    });
  };

  return (
    <div className="border-osrs-bronze/25 space-y-3 border-t pt-4">
      <div>
        <div className="text-osrs-parchment text-sm font-medium">Maintainers</div>
        <p className="text-osrs-parchment-dark/60 text-xs">
          People who run this tool. They can edit its content from this page, but not where it appears.
        </p>
      </div>
      {maintainers.length === 0 ? (
        <p className="text-osrs-parchment-dark/60 text-sm">No maintainers yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {maintainers.map((m) => (
            <li
              key={m.user_id}
              className="border-osrs-bronze/40 flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
            >
              {m.username}
              <button
                type="button"
                aria-label={`Remove ${m.username}`}
                disabled={pending}
                onClick={() => act(() => removeToolMaintainer(listing.id, m.user_id))}
                className="text-osrs-parchment-dark/60 hover:text-osrs-red"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={search} className="flex gap-2">
        <Input
          aria-label="Find a user"
          placeholder="Username or Discord ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="secondary" size="sm" loading={pending} loadingLabel="Searching…">
          Find
        </Button>
      </form>
      {results && (
        <ul className="divide-osrs-bronze/20 border-osrs-bronze/20 divide-y rounded border">
          {results.length === 0 ? (
            <li className="text-osrs-parchment-dark/60 px-3 py-2 text-sm">No users found.</li>
          ) : (
            results.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span>
                  {u.label} <span className="text-osrs-parchment-dark/50">#{u.id}</span>
                </span>
                <Button
                  size="xs"
                  variant="gold-subtle"
                  disabled={pending || maintainers.some((m) => m.user_id === u.id)}
                  onClick={() => act(() => addToolMaintainer(listing.id, u.id))}
                >
                  Add
                </Button>
              </li>
            ))
          )}
        </ul>
      )}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
