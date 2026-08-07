"use client";

/**
 * Group mini-site builder (sites-v1). Dashboard-only client component: claim
 * a subdomain, edit site settings (theme/palette/nav/custom CSS), manage
 * pages, and edit each page's block list with per-type forms.
 *
 * Deliberately form-based like the event-layout editor (add buttons + ↑/↓
 * reorder, no dnd dependency). Draft saves never touch the live site; the
 * publish buttons copy draft → published server-side. All persistence flows
 * through Server Actions that re-check admin + entitlement.
 */
import { useMemo, useState, useTransition } from "react";
import type { SiteAdmin, SiteMeta, SitePageDetail, SitePageSummary } from "@droptracker/api-types";
import { SITE_SUBDOMAIN_RE, SITE_PAGE_SLUG_RE } from "@droptracker/api-types";
import { Alert, Card, fieldInputClass } from "@/components/ui";
import {
  claimSiteAction,
  createSitePageAction,
  deleteSitePageAction,
  loadSitePageAction,
  publishSiteAction,
  publishSitePageAction,
  saveSitePageAction,
  sitePreviewTokenAction,
  updateSiteAction,
} from "@/app/(site)/(admin)/groups/[id]/website/actions";

type Block = Record<string, unknown>;

const PALETTE_EDIT_KEYS: Array<{ key: string; label: string }> = [
  { key: "--dt-gold", label: "Accent" },
  { key: "--dt-gold-bright", label: "Accent bright" },
  { key: "--dt-text", label: "Text" },
  { key: "--dt-surface-0", label: "Background" },
  { key: "--dt-surface-1", label: "Panels" },
  { key: "--dt-bronze", label: "Borders/buttons" },
];

const ADDABLE_BLOCKS: Array<{ type: string; label: string; make: () => Block }> = [
  { type: "hero", label: "Hero", make: () => ({ type: "hero", heading: "Our clan" }) },
  { type: "markdown", label: "Text", make: () => ({ type: "markdown", body: "Write something…" }) },
  {
    type: "stats_row",
    label: "Stat tiles",
    make: () => ({ type: "stats_row", stats: ["members", "monthly_loot", "rank"] }),
  },
  { type: "top_players", label: "Top players", make: () => ({ type: "top_players", period: "month", limit: 10 }) },
  { type: "records", label: "Clan records", make: () => ({ type: "records" }) },
  { type: "boss_activity", label: "Boss activity", make: () => ({ type: "boss_activity", limit: 8 }) },
  { type: "recent_drops", label: "Recent drops", make: () => ({ type: "recent_drops", limit: 10 }) },
  { type: "image", label: "Image", make: () => ({ type: "image", url: "" }) },
  {
    type: "buttons",
    label: "Buttons",
    make: () => ({ type: "buttons", items: [{ label: "Join our Discord", href: "https://" }] }),
  },
  { type: "divider", label: "Divider", make: () => ({ type: "divider", size: "md", rule: true }) },
  { type: "custom_html", label: "Custom HTML", make: () => ({ type: "custom_html", source: "", html: "" }) },
];

let blockSeq = 0;
function newBlockId(): string {
  blockSeq += 1;
  return `b${Date.now().toString(36)}${blockSeq}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-osrs-parchment-dark/80 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function BlockForm({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  const set = (key: string, value: unknown) => onChange({ ...block, [key]: value });
  const type = block.type as string;

  switch (type) {
    case "hero":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Heading">
            <input
              className={fieldInputClass}
              value={(block.heading as string) ?? ""}
              maxLength={80}
              onChange={(e) => set("heading", e.target.value)}
            />
          </Field>
          <Field label="Tagline (optional)">
            <input
              className={fieldInputClass}
              value={(block.tagline as string) ?? ""}
              maxLength={200}
              onChange={(e) => set("tagline", e.target.value || undefined)}
            />
          </Field>
          <Field label="Image URL (optional; defaults to the group icon)">
            <input
              className={fieldInputClass}
              value={(block.image_url as string) ?? ""}
              maxLength={300}
              onChange={(e) => set("image_url", e.target.value || undefined)}
            />
          </Field>
        </div>
      );
    case "markdown":
      return (
        <Field label="Markdown">
          <textarea
            className={`${fieldInputClass} min-h-32 font-mono text-xs`}
            value={(block.body as string) ?? ""}
            maxLength={8000}
            onChange={(e) => set("body", e.target.value)}
          />
        </Field>
      );
    case "stats_row": {
      const chosen = new Set((block.stats as string[]) ?? []);
      const toggle = (k: string) => {
        const next = new Set(chosen);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        set("stats", Array.from(next));
      };
      return (
        <div className="flex flex-wrap gap-3 text-sm">
          {(["members", "monthly_loot", "rank", "top_player"] as const).map((k) => (
            <label key={k} className="flex items-center gap-1.5">
              <input type="checkbox" checked={chosen.has(k)} onChange={() => toggle(k)} />
              {k.replace("_", " ")}
            </label>
          ))}
        </div>
      );
    }
    case "top_players":
    case "recent_drops":
    case "boss_activity":
      return (
        <Field label="How many entries">
          <input
            type="number"
            className={`${fieldInputClass} w-24`}
            min={3}
            max={25}
            value={(block.limit as number) ?? 10}
            onChange={(e) => set("limit", Number(e.target.value))}
          />
        </Field>
      );
    case "image":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Image URL">
            <input
              className={fieldInputClass}
              value={(block.url as string) ?? ""}
              maxLength={300}
              onChange={(e) => set("url", e.target.value)}
            />
          </Field>
          <Field label="Alt text">
            <input
              className={fieldInputClass}
              value={(block.alt as string) ?? ""}
              maxLength={200}
              onChange={(e) => set("alt", e.target.value || undefined)}
            />
          </Field>
          <Field label="Caption (optional)">
            <input
              className={fieldInputClass}
              value={(block.caption as string) ?? ""}
              maxLength={300}
              onChange={(e) => set("caption", e.target.value || undefined)}
            />
          </Field>
        </div>
      );
    case "buttons": {
      const items = (block.items as Array<{ label: string; href: string }>) ?? [];
      const update = (i: number, k: "label" | "href", v: string) => {
        const next = items.map((item, j) => (j === i ? { ...item, [k]: v } : item));
        set("items", next);
      };
      return (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                className={`${fieldInputClass} w-40`}
                placeholder="Label"
                maxLength={40}
                value={item.label}
                onChange={(e) => update(i, "label", e.target.value)}
              />
              <input
                className={`${fieldInputClass} flex-1`}
                placeholder="https://…"
                maxLength={300}
                value={item.href}
                onChange={(e) => update(i, "href", e.target.value)}
              />
              <button
                type="button"
                className="text-osrs-red text-sm"
                onClick={() => set("items", items.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          {items.length < 6 && (
            <button
              type="button"
              className="text-osrs-gold text-sm underline"
              onClick={() => set("items", [...items, { label: "", href: "https://" }])}
            >
              + add button
            </button>
          )}
        </div>
      );
    }
    case "divider":
      return (
        <div className="flex items-center gap-4 text-sm">
          <Field label="Size">
            <select
              className={fieldInputClass}
              value={(block.size as string) ?? "md"}
              onChange={(e) => set("size", e.target.value)}
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </Field>
          <label className="mt-5 flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={(block.rule as boolean) ?? true}
              onChange={(e) => set("rule", e.target.checked)}
            />
            show line
          </label>
        </div>
      );
    case "custom_html":
      return (
        <div>
          <Field label="HTML source (sanitized on save — scripts, forms and styles are stripped)">
            <textarea
              className={`${fieldInputClass} min-h-40 font-mono text-xs`}
              value={(block.source as string) ?? ""}
              onChange={(e) => set("source", e.target.value)}
            />
          </Field>
          <p className="text-osrs-parchment-dark/60 mt-1 text-xs">
            Allowed: headings, text, lists, tables, images and https links. The saved result is
            what renders — use the draft preview to see it exactly.
          </p>
        </div>
      );
    default:
      return (
        <p className="text-osrs-parchment-dark/60 text-xs">
          This block type has no editable settings here yet.
        </p>
      );
  }
}

const BLOCK_LABELS: Record<string, string> = Object.fromEntries(
  ADDABLE_BLOCKS.map((b) => [b.type, b.label]),
);

export function SiteBuilder({
  groupId,
  initialSite,
  meta,
}: {
  groupId: number;
  initialSite: SiteAdmin | null;
  meta: SiteMeta;
}) {
  const [site, setSite] = useState<SiteAdmin | null>(initialSite);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // claim form
  const [claimSub, setClaimSub] = useState("");
  const [tosAccepted, setTosAccepted] = useState(false);
  const claimShapeOk = SITE_SUBDOMAIN_RE.test(claimSub) && !claimSub.startsWith("xn--");
  const claimReserved = useMemo(
    () => meta.reserved_subdomains.includes(claimSub),
    [claimSub, meta.reserved_subdomains],
  );

  // settings
  const [themeKey, setThemeKey] = useState(initialSite?.theme_key ?? "dusk");
  const [palette, setPalette] = useState<Record<string, string>>(initialSite?.palette ?? {});
  const [css, setCss] = useState(initialSite?.custom_css_source ?? "");

  // pages / editor
  const [editing, setEditing] = useState<SitePageDetail | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [dirty, setDirty] = useState(false);

  // new page form
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");

  function run<T>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, then?: (data: T) => void) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        then?.(result.data);
      } else {
        setError(result.error);
      }
    });
  }

  if (!site) {
    return (
      <Card>
        <h2 className="text-osrs-gold mb-2 text-lg font-semibold">Claim your site address</h2>
        <p className="text-osrs-parchment-dark/80 mb-4 max-w-2xl text-sm">
          Pick the subdomain your clan&apos;s website will live on. 3–30 characters: lowercase
          letters, numbers and hyphens.
        </p>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${fieldInputClass} w-56`}
            placeholder="your-clan"
            value={claimSub}
            onChange={(e) => setClaimSub(e.target.value.toLowerCase().trim())}
          />
          <span className="text-osrs-parchment-dark/70 text-sm">.{meta.sites_domain}</span>
        </div>
        {claimSub && !claimShapeOk && (
          <p className="text-osrs-red mt-2 text-xs">That address isn&apos;t a valid subdomain.</p>
        )}
        {claimReserved && <p className="text-osrs-red mt-2 text-xs">That address is reserved.</p>}
        <label className="mt-4 flex max-w-2xl items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={tosAccepted}
            onChange={(e) => setTosAccepted(e.target.checked)}
          />
          <span className="text-osrs-parchment-dark/80">
            I accept the hosted-content terms: no impersonation, no credential harvesting, no
            real-world trading or rule-breaking content. Sites can be suspended for violations.
          </span>
        </label>
        <button
          type="button"
          disabled={!claimShapeOk || claimReserved || !tosAccepted || pending}
          className="bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark mt-4 rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          onClick={() => run(() => claimSiteAction(groupId, claimSub), setSite)}
        >
          {pending ? "Claiming…" : "Claim address"}
        </button>
      </Card>
    );
  }

  const openEditor = (page: SitePageSummary) =>
    run(
      () => loadSitePageAction(groupId, page.page_id),
      (detail) => {
        setEditing(detail);
        setBlocks(detail.draft_blocks);
        setDirty(false);
      },
    );

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-osrs-gold text-lg font-semibold">{site.site_url}</h2>
            <p className="text-osrs-parchment-dark/70 text-sm">
              {site.published ? "Site is live." : "Site is not published yet."}
              {site.needs_review && " Search-engine indexing is pending review."}
              {site.suspended && ` SUSPENDED: ${site.suspend_reason ?? ""}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1.5 text-sm"
              onClick={() =>
                run(
                  () => sitePreviewTokenAction(groupId),
                  ({ token, site_url }) => {
                    const slug = editing?.slug ?? "home";
                    window.open(`${site_url}__preview/${slug}?token=${encodeURIComponent(token)}`, "_blank");
                  },
                )
              }
            >
              Open draft preview
            </button>
            <button
              type="button"
              disabled={pending}
              className="bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium"
              onClick={() =>
                run(
                  () => publishSiteAction(groupId, !site.published),
                  (s) => {
                    setSite(s);
                    setNotice(s.published ? "Site published." : "Site unpublished.");
                  },
                )
              }
            >
              {site.published ? "Unpublish site" : "Publish site"}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-osrs-gold mb-3 font-semibold">Appearance</h3>
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Theme">
            <select
              className={fieldInputClass}
              value={themeKey}
              onChange={(e) => setThemeKey(e.target.value)}
            >
              {meta.theme_keys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>
          {PALETTE_EDIT_KEYS.map(({ key, label }) => (
            <Field key={key} label={label}>
              <input
                type="color"
                className="h-9 w-14 cursor-pointer rounded border-0 bg-transparent"
                value={palette[key] ?? "#000000"}
                onChange={(e) => setPalette({ ...palette, [key]: e.target.value })}
              />
            </Field>
          ))}
          <button
            type="button"
            className="text-osrs-parchment-dark/70 text-sm underline"
            onClick={() => setPalette({})}
          >
            reset colors
          </button>
        </div>
        <div className="mt-4">
          <Field label={`Custom CSS (advanced — max ${Math.floor(meta.limits.max_custom_css_bytes / 1024)} KB; validated on save)`}>
            <textarea
              className={`${fieldInputClass} min-h-28 font-mono text-xs`}
              value={css}
              onChange={(e) => setCss(e.target.value)}
              placeholder=".my-banner { border: 2px solid var(--dt-gold); }"
            />
          </Field>
        </div>
        <button
          type="button"
          disabled={pending}
          className="bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark mt-3 rounded px-4 py-1.5 text-sm font-medium"
          onClick={() =>
            run(
              () =>
                updateSiteAction(groupId, {
                  theme_key: themeKey,
                  palette,
                  custom_css_source: css,
                }),
              (s) => {
                setSite(s);
                setNotice("Appearance saved.");
              },
            )
          }
        >
          Save appearance
        </button>
      </Card>

      <Card>
        <h3 className="text-osrs-gold mb-3 font-semibold">Pages</h3>
        <ul className="divide-osrs-bronze/20 divide-y">
          {site.pages.map((p) => (
            <li key={p.page_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <span className="font-medium">{p.title}</span>{" "}
                <span className="text-osrs-parchment-dark/60 text-xs">
                  /{p.slug === "home" ? "" : p.slug}
                  {p.published ? " · live" : " · draft"}
                  {p.has_draft_changes && p.published ? " · unpublished changes" : ""}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-2 py-1 text-xs"
                  onClick={() => openEditor(p)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-2 py-1 text-xs"
                  onClick={() =>
                    run(
                      () => publishSitePageAction(groupId, p.page_id, !p.published, site.subdomain),
                      (updated) => {
                        setSite({
                          ...site,
                          pages: site.pages.map((x) => (x.page_id === updated.page_id ? updated : x)),
                        });
                        setNotice(updated.published ? `Published “${updated.title}”.` : `Unpublished “${updated.title}”.`);
                      },
                    )
                  }
                >
                  {p.published ? "Unpublish" : "Publish"}
                </button>
                {p.slug !== "home" && (
                  <button
                    type="button"
                    disabled={pending}
                    className="text-osrs-red rounded px-2 py-1 text-xs"
                    onClick={() => {
                      if (!window.confirm(`Delete page “${p.title}”?`)) return;
                      run(
                        () => deleteSitePageAction(groupId, p.page_id, site.subdomain),
                        () => {
                          setSite({ ...site, pages: site.pages.filter((x) => x.page_id !== p.page_id) });
                          if (editing?.page_id === p.page_id) setEditing(null);
                        },
                      );
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {site.pages.length < meta.limits.max_pages && (
          <div className="border-osrs-bronze/20 mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
            <input
              className={`${fieldInputClass} w-40`}
              placeholder="page-slug"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value.toLowerCase().trim())}
            />
            <input
              className={`${fieldInputClass} w-56`}
              placeholder="Page title"
              maxLength={80}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <button
              type="button"
              disabled={pending || !SITE_PAGE_SLUG_RE.test(newSlug) || !newTitle.trim()}
              className="bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              onClick={() =>
                run(
                  () => createSitePageAction(groupId, newSlug, newTitle.trim()),
                  (page) => {
                    setSite({ ...site, pages: [...site.pages, page] });
                    setNewSlug("");
                    setNewTitle("");
                  },
                )
              }
            >
              Add page
            </button>
          </div>
        )}
      </Card>

      {editing && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-osrs-gold font-semibold">
              Editing: {editing.title}
              {dirty && <span className="text-osrs-ember ml-2 text-xs">unsaved changes</span>}
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending || !dirty}
                className="bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                onClick={() =>
                  run(
                    () => saveSitePageAction(groupId, editing.page_id, { blocks }),
                    (page) => {
                      setEditing(page);
                      setBlocks(page.draft_blocks);
                      setDirty(false);
                      setSite({
                        ...site,
                        pages: site.pages.map((x) =>
                          x.page_id === page.page_id ? { ...x, has_draft_changes: true } : x,
                        ),
                      });
                      setNotice("Draft saved.");
                    },
                  )
                }
              >
                Save draft
              </button>
              <button
                type="button"
                className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1.5 text-sm"
                onClick={() => setEditing(null)}
              >
                Close
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {blocks.map((b, i) => (
              <div key={(b.id as string) ?? i} className="border-osrs-bronze/30 rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-osrs-parchment-dark/80 text-xs font-semibold uppercase">
                    {BLOCK_LABELS[b.type as string] ?? (b.type as string)}
                  </span>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      disabled={i === 0}
                      className="border-osrs-bronze/40 rounded border px-1.5 text-xs disabled:opacity-30"
                      onClick={() => {
                        const next = [...blocks];
                        [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                        setBlocks(next);
                        setDirty(true);
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={i === blocks.length - 1}
                      className="border-osrs-bronze/40 rounded border px-1.5 text-xs disabled:opacity-30"
                      onClick={() => {
                        const next = [...blocks];
                        [next[i], next[i + 1]] = [next[i + 1]!, next[i]!];
                        setBlocks(next);
                        setDirty(true);
                      }}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="text-osrs-red px-1.5 text-xs"
                      onClick={() => {
                        setBlocks(blocks.filter((_, j) => j !== i));
                        setDirty(true);
                      }}
                    >
                      ✕
                    </button>
                  </span>
                </div>
                <BlockForm
                  block={b}
                  onChange={(nb) => {
                    setBlocks(blocks.map((x, j) => (j === i ? nb : x)));
                    setDirty(true);
                  }}
                />
              </div>
            ))}
          </div>

          {blocks.length < meta.limits.max_blocks_per_page && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {ADDABLE_BLOCKS.map((def) => (
                <button
                  key={def.type}
                  type="button"
                  className="border-osrs-bronze/40 hover:bg-osrs-bronze/30 rounded border px-2 py-1 text-xs"
                  onClick={() => {
                    setBlocks([...blocks, { ...def.make(), id: newBlockId() }]);
                    setDirty(true);
                  }}
                >
                  + {def.label}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
