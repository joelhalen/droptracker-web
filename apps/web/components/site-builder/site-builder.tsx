"use client";

/**
 * Group mini-site builder shell (sites-v1): claim flow, appearance (theme +
 * palette + custom CSS + roster toggle), navigation editor, page management,
 * and the drag-and-drop page editor (page-editor.tsx).
 *
 * Palette inputs default to the ACTIVE THEME's preset value for each key —
 * not #000000 — so the pickers always show the color the site actually
 * renders with until overridden. All persistence flows through Server
 * Actions that re-check admin + entitlement.
 */
import { useMemo, useState, useTransition } from "react";
import type {
  GroupProfile,
  SiteAdmin,
  SiteMeta,
  SiteNavItem,
  SitePageDetail,
  SitePageSummary,
  SiteMode,
} from "@droptracker/api-types";
import { SITE_SUBDOMAIN_RE, SITE_PAGE_SLUG_RE } from "@droptracker/api-types";
import { SITE_THEMES, type SiteThemeKey } from "@/lib/site-themes";
import { Alert, Card, fieldInputClass } from "@/components/ui";
import { Field, type Block } from "./block-forms";
import { PageEditor } from "./page-editor";
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

const MODE_OPTIONS: Array<{ value: SiteMode; label: string; help: string }> = [
  {
    value: "builder",
    label: "Show a site I build",
    help: "Design pages with the block editor below.",
  },
  {
    value: "group_page",
    label: "Redirect to our DropTracker page",
    help: "Visitors land on your group's profile — no site to maintain.",
  },
  {
    value: "redirect",
    label: "Redirect somewhere else",
    help: "Point the address at your Discord invite, forum, or any https:// link.",
  },
];

const PALETTE_EDIT_KEYS: Array<{ key: string; label: string }> = [
  { key: "--dt-gold", label: "Accent" },
  { key: "--dt-gold-bright", label: "Accent bright" },
  { key: "--dt-text", label: "Text" },
  { key: "--dt-surface-0", label: "Background" },
  { key: "--dt-surface-1", label: "Panels" },
  { key: "--dt-bronze", label: "Borders/buttons" },
];

/** The color the picker should show when no override is saved: the active
 *  theme's own value for that variable (never black). */
function themeDefault(themeKey: string, varKey: string): string {
  const preset = SITE_THEMES[themeKey as SiteThemeKey] ?? SITE_THEMES.dusk;
  const value = preset[varKey] ?? "#000000";
  return value.startsWith("#") ? value : "#000000";
}

export function SiteBuilder({
  groupId,
  initialSite,
  meta,
  group,
}: {
  groupId: number;
  initialSite: SiteAdmin | null;
  meta: SiteMeta;
  group: GroupProfile;
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

  // appearance
  const [themeKey, setThemeKey] = useState(initialSite?.theme_key ?? "dusk");
  const [palette, setPalette] = useState<Record<string, string>>(initialSite?.palette ?? {});
  const [css, setCss] = useState(initialSite?.custom_css_source ?? "");
  const [rosterPublic, setRosterPublic] = useState(initialSite?.roster_public ?? false);

  // navigation
  const [nav, setNav] = useState<SiteNavItem[]>(initialSite?.nav ?? []);

  // what the subdomain does
  const [mode, setMode] = useState(initialSite?.mode ?? "builder");
  const [redirectUrl, setRedirectUrl] = useState(initialSite?.redirect_url ?? "");

  // page editor
  const [editing, setEditing] = useState<SitePageDetail | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);

  // new page form
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");

  function run<T>(
    fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>,
    then?: (data: T) => void,
  ) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) then?.(result.data);
      else setError(result.error);
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
        setEditorDirty(false);
      },
    );

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-osrs-gold text-lg font-semibold">
              <a href={site.site_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {site.site_url}
              </a>
            </h2>
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
                    window.open(
                      `${site_url}__preview/${slug}?token=${encodeURIComponent(token)}`,
                      "_blank",
                    );
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
        <h3 className="text-osrs-gold mb-1 font-semibold">What this address does</h3>
        <p className="text-osrs-parchment-dark/60 mb-3 text-xs">
          Not every clan wants to run a site — your address can simply point somewhere
          you already have.
        </p>
        <div className="space-y-2">
          {MODE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
                mode === opt.value
                  ? "border-osrs-gold/70 bg-osrs-surface-2"
                  : "border-osrs-bronze/30 hover:bg-osrs-surface-2/50"
              }`}
            >
              <input
                type="radio"
                name="site-mode"
                className="mt-1"
                checked={mode === opt.value}
                onChange={() => setMode(opt.value)}
              />
              <span>
                <span className="block text-sm font-medium">{opt.label}</span>
                <span className="text-osrs-parchment-dark/70 block text-xs">{opt.help}</span>
              </span>
            </label>
          ))}
        </div>

        {mode === "redirect" && (
          <div className="mt-3">
            <Field label="Send visitors to">
              <input
                className={fieldInputClass}
                placeholder="https://discord.gg/your-invite"
                maxLength={500}
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
              />
            </Field>
            <p className="text-osrs-parchment-dark/55 mt-1 text-[11px]">
              Must be a full https:// address, and can&apos;t point back at{" "}
              {meta.sites_domain}.
            </p>
          </div>
        )}
        {mode === "group_page" && (
          <p className="text-osrs-parchment-dark/70 mt-3 text-xs">
            Visitors will land on your DropTracker group profile.
          </p>
        )}

        <button
          type="button"
          disabled={
            pending || (mode === "redirect" && !redirectUrl.trim().toLowerCase().startsWith("https://"))
          }
          className="bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark mt-4 rounded px-4 py-1.5 text-sm font-medium disabled:opacity-50"
          onClick={() =>
            run(
              () =>
                updateSiteAction(groupId, {
                  mode,
                  ...(mode === "redirect" ? { redirect_url: redirectUrl.trim() } : {}),
                }),
              (s2) => {
                setSite(s2);
                setMode(s2.mode);
                setRedirectUrl(s2.redirect_url);
                setNotice(
                  s2.mode === "builder"
                    ? "Your address now shows the pages you build below."
                    : `Your address now redirects to ${s2.redirect_target}.`,
                );
              },
            )
          }
        >
          Save
        </button>
      </Card>

      {mode !== "builder" && (
        <Card>
          <p className="text-osrs-parchment-dark/75 text-sm">
            Page building is paused while this address is a redirect. Your pages are kept —
            switch back to &quot;Show a site I build&quot; above to use them again.
          </p>
        </Card>
      )}

      {mode === "builder" && editing && (
        <PageEditor
          site={{ ...site, nav }}
          meta={meta}
          group={group}
          pageTitle={editing.title}
          pagePublished={editing.published}
          hasUnpublishedChanges={editing.has_draft_changes}
          initialBlocks={editing.draft_blocks as Block[]}
          initialPageCss={editing.custom_css_source ?? ""}
          saving={pending}
          saveError={error}
          onDirtyChange={setEditorDirty}
          onSave={(blocks, pageCss) =>
            run(
              () =>
                saveSitePageAction(groupId, editing.page_id, {
                  blocks,
                  custom_css_source: pageCss,
                }),
              (page) => {
                setEditing(page);
                setSite({
                  ...site,
                  pages: site.pages.map((x) =>
                    x.page_id === page.page_id ? { ...x, has_draft_changes: true } : x,
                  ),
                });
                setNotice("Draft saved. Publish the page to put it live.");
              },
            )
          }
          onPublish={(blocks, pageCss, dirty) =>
            run(
              async () => {
                // Publish always publishes what the admin SEES: save the
                // draft first when there are unsaved edits, then copy
                // draft → published.
                if (dirty) {
                  const saved = await saveSitePageAction(groupId, editing.page_id, {
                    blocks,
                    custom_css_source: pageCss,
                  });
                  if (!saved.ok) return saved;
                }
                return publishSitePageAction(groupId, editing.page_id, true, site.subdomain);
              },
              (updated) => {
                setEditing({
                  ...editing,
                  draft_blocks: blocks,
                  published: true,
                  has_draft_changes: false,
                });
                setSite({
                  ...site,
                  pages: site.pages.map((x) => (x.page_id === updated.page_id ? updated : x)),
                });
                setNotice(`Published “${updated.title}” — live within a minute.`);
              },
            )
          }
          onClose={() => setEditing(null)}
        />
      )}

      {mode === "builder" && (
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
                  onClick={() => {
                    if (editorDirty && !window.confirm("Discard unsaved changes?")) return;
                    openEditor(p);
                  }}
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
                          pages: site.pages.map((x) =>
                            x.page_id === updated.page_id ? updated : x,
                          ),
                        });
                        setNotice(
                          updated.published
                            ? `Published “${updated.title}”.`
                            : `Unpublished “${updated.title}”.`,
                        );
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
                          setSite({
                            ...site,
                            pages: site.pages.filter((x) => x.page_id !== p.page_id),
                          });
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

      )}

      {mode === "builder" && (
      <Card>
        <h3 className="text-osrs-gold mb-1 font-semibold">Navigation</h3>
        <p className="text-osrs-parchment-dark/60 mb-3 text-xs">
          The links in your site&apos;s header, in order. Point each at one of your pages or an
          external https:// link.
        </p>
        <div className="space-y-2">
          {nav.map((item, i) => {
            const isPage = item.page_slug != null;
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  className={`${fieldInputClass} w-36`}
                  placeholder="Label"
                  maxLength={40}
                  value={item.label}
                  onChange={(e) =>
                    setNav(nav.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                  }
                />
                <select
                  className={fieldInputClass}
                  value={isPage ? "page" : "link"}
                  onChange={(e) =>
                    setNav(
                      nav.map((x, j) =>
                        j === i
                          ? e.target.value === "page"
                            ? { label: x.label, page_slug: site.pages[0]?.slug ?? "home" }
                            : { label: x.label, href: "https://" }
                          : x,
                      ),
                    )
                  }
                >
                  <option value="page">Page</option>
                  <option value="link">External link</option>
                </select>
                {isPage ? (
                  <select
                    className={fieldInputClass}
                    value={item.page_slug}
                    onChange={(e) =>
                      setNav(
                        nav.map((x, j) => (j === i ? { ...x, page_slug: e.target.value } : x)),
                      )
                    }
                  >
                    {site.pages.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.title} (/{p.slug === "home" ? "" : p.slug})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={`${fieldInputClass} min-w-56 flex-1`}
                    placeholder="https://…"
                    maxLength={300}
                    value={item.href ?? ""}
                    onChange={(e) =>
                      setNav(nav.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)))
                    }
                  />
                )}
                <span className="flex gap-1">
                  <button
                    type="button"
                    disabled={i === 0}
                    className="border-osrs-bronze/40 rounded border px-1.5 text-xs disabled:opacity-30"
                    onClick={() => {
                      const next = [...nav];
                      [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                      setNav(next);
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={i === nav.length - 1}
                    className="border-osrs-bronze/40 rounded border px-1.5 text-xs disabled:opacity-30"
                    onClick={() => {
                      const next = [...nav];
                      [next[i], next[i + 1]] = [next[i + 1]!, next[i]!];
                      setNav(next);
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="text-osrs-red px-1.5 text-xs"
                    onClick={() => setNav(nav.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {nav.length < meta.limits.max_nav_items && (
            <button
              type="button"
              className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1.5 text-sm"
              onClick={() =>
                setNav([...nav, { label: "Home", page_slug: site.pages[0]?.slug ?? "home" }])
              }
            >
              + Add entry
            </button>
          )}
          <button
            type="button"
            disabled={pending || nav.some((n) => !n.label.trim())}
            className="bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            onClick={() =>
              run(
                () => updateSiteAction(groupId, { nav }),
                (s) => {
                  setSite(s);
                  setNav(s.nav);
                  setNotice("Navigation saved.");
                },
              )
            }
          >
            Save navigation
          </button>
        </div>
      </Card>

      )}

      {mode === "builder" && (
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
              <span className="flex items-center gap-1">
                <input
                  type="color"
                  className="h-9 w-14 cursor-pointer rounded border-0 bg-transparent"
                  value={palette[key] ?? themeDefault(themeKey, key)}
                  onChange={(e) => setPalette({ ...palette, [key]: e.target.value })}
                />
                {palette[key] && (
                  <button
                    type="button"
                    title="Reset to theme default"
                    className="text-osrs-parchment-dark/60 hover:text-osrs-gold text-xs"
                    onClick={() => {
                      const next = { ...palette };
                      delete next[key];
                      setPalette(next);
                    }}
                  >
                    ↺
                  </button>
                )}
              </span>
            </Field>
          ))}
          <button
            type="button"
            className="text-osrs-parchment-dark/70 text-sm underline"
            onClick={() => setPalette({})}
          >
            reset all colors
          </button>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={rosterPublic}
            onChange={(e) => setRosterPublic(e.target.checked)}
          />
          <span className="text-osrs-parchment-dark/80">
            Public member roster — lets the &quot;Member roster&quot; block list your members
            (hidden players are always excluded)
          </span>
        </label>
        <div className="mt-4">
          <Field
            label={`Custom CSS (advanced — max ${Math.floor(meta.limits.max_custom_css_bytes / 1024)} KB; validated on save)`}
          >
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
                  roster_public: rosterPublic,
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
      )}
    </div>
  );
}
