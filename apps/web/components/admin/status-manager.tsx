"use client";

import { useState, useTransition } from "react";
import { Alert, Card, EmptyState } from "@/components/ui";
import {
  ISSUE_SEVERITIES,
  ISSUE_STATUSES,
  SEVERITY_META,
  type IssueSeverity,
  type IssueStatus,
  type KnownIssue,
  type KnownIssueCategory,
  type KnownIssueCategoryInput,
  type KnownIssueInput,
  type StatusServices,
} from "@/lib/known-issues";
import {
  createStatusCategory,
  createStatusIssue,
  deleteStatusCategory,
  deleteStatusIssue,
  refreshStatusServices,
  updateStatusCategory,
  updateStatusIssue,
} from "@/app/(site)/(admin)/admin/status/actions";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";

const buttonPrimary =
  "bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50";

const OFFLINE_TONE = { dot: "bg-red-500", label: "Offline" };
const SERVICE_TONE: Record<string, { dot: string; label: string }> = {
  operational: { dot: "bg-emerald-500", label: "Operational" },
  degraded: { dot: "bg-orange-400", label: "Degraded" },
  offline: OFFLINE_TONE,
};

const sortByOrder = <T extends { order: number; id: number }>(items: T[]): T[] =>
  [...items].sort((a, b) => a.order - b.order || a.id - b.id);

// ---------------------------------------------------------------------------
// Health strip
// ---------------------------------------------------------------------------

function num(n: number): string {
  return n.toLocaleString("en-US");
}

function ServiceCard({
  title,
  status,
  players,
  processed,
  extra,
}: {
  title: string;
  status: string;
  players: number;
  processed: { "5m": number; "30m": number; "24h": number };
  extra?: string | null;
}) {
  const tone = SERVICE_TONE[status] ?? OFFLINE_TONE;
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold">{title}</div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${tone.dot}`} />
          {tone.label}
        </div>
      </div>
      <div className="text-osrs-parchment-dark/70 mt-3 space-y-1 text-sm">
        <div>
          <span className="text-osrs-gold-bright font-medium">{num(players)}</span> players active
          (last hour)
        </div>
        <div>
          Processed <span className="font-medium">{num(processed["5m"])}</span> (5m) ·{" "}
          <span className="font-medium">{num(processed["30m"])}</span> (30m) ·{" "}
          <span className="font-medium">{num(processed["24h"])}</span> (24h)
        </div>
        {extra && <div className="text-osrs-red">{extra}</div>}
      </div>
    </Card>
  );
}

function HealthStrip({ initial }: { initial: StatusServices }) {
  const [services, setServices] = useState(initial);
  const [pending, startTransition] = useTransition();

  const refresh = () =>
    startTransition(async () => {
      try {
        setServices(await refreshStatusServices());
      } catch {
        // keep showing the last snapshot
      }
    });

  const apiExtra = !services.api.online
    ? "Intake API is not responding."
    : !services.api.consumer_alive
      ? "Queue consumer is not responding."
      : services.api.status === "degraded" && services.api.queue_depth
        ? `Processing backlog: ${num(services.api.queue_depth)} queued.`
        : null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-osrs-gold font-semibold">Live service health</h2>
        <div className="text-osrs-parchment-dark/50 flex items-center gap-3 text-xs">
          {services.generated_at > 0 && (
            <span>as of {new Date(services.generated_at * 1000).toLocaleTimeString()}</span>
          )}
          <button onClick={refresh} disabled={pending} className="text-osrs-gold-bright hover:underline disabled:opacity-50">
            {pending ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ServiceCard
          title="Submission API"
          status={services.api.status}
          players={services.api.players_1h}
          processed={services.api.processed}
          extra={apiExtra}
        />
        <ServiceCard
          title="Webhook processing"
          status={services.webhook.status}
          players={services.webhook.players_1h}
          processed={services.webhook.processed}
          extra={services.webhook.online ? null : "Webhook reader bot is offline."}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Known-issues board
// ---------------------------------------------------------------------------

const blankCategory = (): KnownIssueCategoryInput => ({ name: "", emoji: null, order: 100 });

const blankIssue = (categoryId: number): KnownIssueInput => ({
  category_id: categoryId,
  title: "",
  description: null,
  severity: "minor",
  status: "open",
  order: 100,
});

export function StatusManager({
  services,
  categories,
}: {
  services: StatusServices;
  categories: KnownIssueCategory[];
}) {
  const [list, setList] = useState(() => sortByOrder(categories));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Which entity has an open form: a category editor, or an issue editor.
  const [categoryForm, setCategoryForm] = useState<number | "new" | null>(null);
  const [issueForm, setIssueForm] = useState<{ categoryId: number; issueId: number | null } | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState<
    { kind: "category" | "issue"; id: number } | null
  >(null);

  const applyCategory = (saved: KnownIssueCategory) =>
    setList((l) => {
      const exists = l.some((c) => c.id === saved.id);
      const next = exists
        ? l.map((c) => (c.id === saved.id ? { ...saved, issues: saved.issues.length ? saved.issues : c.issues } : c))
        : [...l, saved];
      return sortByOrder(next);
    });

  const applyIssue = (saved: KnownIssue) =>
    setList((l) =>
      sortByOrder(
        l.map((c) => {
          const without = c.issues.filter((i) => i.id !== saved.id);
          return c.id === saved.category_id
            ? { ...c, issues: sortByOrder([...without, saved]) }
            : { ...c, issues: without };
        }),
      ),
    );

  const doDeleteCategory = (id: number) =>
    startTransition(async () => {
      setError(null);
      try {
        await deleteStatusCategory(id);
        setList((l) => l.filter((c) => c.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete this category.");
      }
      setConfirmDelete(null);
    });

  const doDeleteIssue = (id: number) =>
    startTransition(async () => {
      setError(null);
      try {
        await deleteStatusIssue(id);
        setList((l) => l.map((c) => ({ ...c, issues: c.issues.filter((i) => i.id !== id) })));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete this issue.");
      }
      setConfirmDelete(null);
    });

  const quickStatus = (issue: KnownIssue, status: IssueStatus) =>
    startTransition(async () => {
      setError(null);
      try {
        applyIssue(await updateStatusIssue(issue.id, { status }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update this issue.");
      }
    });

  return (
    <div className="space-y-8">
      <HealthStrip initial={services} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-osrs-gold font-semibold">Known issues</h2>
          <button onClick={() => setCategoryForm("new")} className={buttonPrimary}>
            + New category
          </button>
        </div>

        {error && (
          <div className="mb-4">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {categoryForm === "new" && (
          <div className="mb-4">
            <CategoryForm
              initial={blankCategory()}
              id={null}
              onClose={() => setCategoryForm(null)}
              onSaved={(saved) => {
                applyCategory(saved);
                setCategoryForm(null);
              }}
            />
          </div>
        )}

        {list.length === 0 && categoryForm !== "new" ? (
          <EmptyState
            title="No issue categories yet"
            hint="Add a category (e.g. Plugin, Website, Discord) and file issues beneath it."
          />
        ) : (
          <div className="space-y-4">
            {list.map((cat) => (
              <Card key={cat.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">
                    {cat.emoji ? `${cat.emoji} ` : ""}
                    {cat.name}
                    <span className="text-osrs-parchment-dark/40 ml-2 text-xs font-normal">
                      order {cat.order}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <button
                      onClick={() => setIssueForm({ categoryId: cat.id, issueId: null })}
                      className="text-osrs-gold-bright hover:underline"
                    >
                      + Add issue
                    </button>
                    <button
                      onClick={() => setCategoryForm(cat.id)}
                      className="text-osrs-gold-bright hover:underline"
                    >
                      Edit
                    </button>
                    {confirmDelete?.kind === "category" && confirmDelete.id === cat.id ? (
                      <>
                        <button
                          onClick={() => doDeleteCategory(cat.id)}
                          disabled={pending}
                          className="text-osrs-red font-medium disabled:opacity-50"
                        >
                          {pending ? "…" : "Confirm (deletes its issues)"}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete({ kind: "category", id: cat.id })}
                        className="text-osrs-parchment-dark/60 hover:text-osrs-red"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {categoryForm === cat.id && (
                  <div className="mt-3">
                    <CategoryForm
                      initial={{ name: cat.name, emoji: cat.emoji, order: cat.order }}
                      id={cat.id}
                      onClose={() => setCategoryForm(null)}
                      onSaved={(saved) => {
                        applyCategory(saved);
                        setCategoryForm(null);
                      }}
                    />
                  </div>
                )}

                {cat.issues.length === 0 ? (
                  <p className="text-osrs-parchment-dark/50 mt-3 text-sm">No issues filed.</p>
                ) : (
                  <ul className="divide-osrs-bronze/20 mt-3 divide-y">
                    {cat.issues.map((issue) => (
                      <li
                        key={issue.id}
                        className={`py-2.5 text-sm ${issue.status === "resolved" ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-block h-2 w-2 shrink-0 rounded-full ${SEVERITY_META[issue.severity].dot}`}
                                title={SEVERITY_META[issue.severity].label}
                              />
                              <span className="font-medium">{issue.title}</span>
                              {issue.status !== "open" && (
                                <span className="text-osrs-parchment-dark/50 text-xs">
                                  ({issue.status})
                                </span>
                              )}
                            </div>
                            {issue.description && (
                              <p className="text-osrs-parchment-dark/60 mt-1 text-xs">
                                {issue.description}
                              </p>
                            )}
                            <div className="text-osrs-parchment-dark/40 mt-1 flex flex-wrap gap-2 text-xs">
                              <span>{SEVERITY_META[issue.severity].label}</span>
                              {issue.created_by && <span>· by {issue.created_by}</span>}
                              {issue.created_at && (
                                <span>· since {new Date(issue.created_at).toLocaleDateString()}</span>
                              )}
                              <span>· order {issue.order}</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-3 text-xs">
                            {issue.status === "resolved" ? (
                              <button
                                onClick={() => quickStatus(issue, "open")}
                                disabled={pending}
                                className="text-osrs-gold-bright hover:underline disabled:opacity-50"
                              >
                                Reopen
                              </button>
                            ) : (
                              <button
                                onClick={() => quickStatus(issue, "resolved")}
                                disabled={pending}
                                className="text-osrs-green hover:underline disabled:opacity-50"
                              >
                                Resolve
                              </button>
                            )}
                            <button
                              onClick={() => setIssueForm({ categoryId: cat.id, issueId: issue.id })}
                              className="text-osrs-gold-bright hover:underline"
                            >
                              Edit
                            </button>
                            {confirmDelete?.kind === "issue" && confirmDelete.id === issue.id ? (
                              <>
                                <button
                                  onClick={() => doDeleteIssue(issue.id)}
                                  disabled={pending}
                                  className="text-osrs-red font-medium disabled:opacity-50"
                                >
                                  {pending ? "…" : "Confirm"}
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setConfirmDelete({ kind: "issue", id: issue.id })}
                                className="text-osrs-parchment-dark/60 hover:text-osrs-red"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>

                        {issueForm?.issueId === issue.id && (
                          <div className="mt-3">
                            <IssueForm
                              initial={{
                                category_id: issue.category_id,
                                title: issue.title,
                                description: issue.description,
                                severity: issue.severity,
                                status: issue.status,
                                order: issue.order,
                              }}
                              id={issue.id}
                              categories={list}
                              onClose={() => setIssueForm(null)}
                              onSaved={(saved) => {
                                applyIssue(saved);
                                setIssueForm(null);
                              }}
                            />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {issueForm?.categoryId === cat.id && issueForm.issueId === null && (
                  <div className="mt-3">
                    <IssueForm
                      initial={blankIssue(cat.id)}
                      id={null}
                      categories={list}
                      onClose={() => setIssueForm(null)}
                      onSaved={(saved) => {
                        applyIssue(saved);
                        setIssueForm(null);
                      }}
                    />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

function CategoryForm({
  initial,
  id,
  onClose,
  onSaved,
}: {
  initial: KnownIssueCategoryInput;
  id: number | null;
  onClose: () => void;
  onSaved: (category: KnownIssueCategory) => void;
}) {
  const isNew = id === null;
  const [draft, setDraft] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const name = draft.name.trim();
  const canSave = name.length > 0 && name.length <= 100 && !pending;

  const onSave = () =>
    startTransition(async () => {
      setError(null);
      try {
        const payload = { ...draft, name, emoji: draft.emoji?.trim() || null };
        const saved = isNew
          ? await createStatusCategory(payload)
          : await updateStatusCategory(id!, payload);
        onSaved(saved);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save this category.");
      }
    });

  return (
    <div className="border-osrs-gold/40 space-y-4 rounded border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-osrs-gold text-sm font-semibold">
          {isNew ? "New category" : "Edit category"}
        </h3>
        <button onClick={onClose} className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright">
          Close
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Name</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Plugin"
            className={field}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Emoji (optional)</span>
          <input
            value={draft.emoji ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, emoji: e.target.value || null }))}
            placeholder="🧩"
            className={field}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Order (lower first)</span>
          <input
            type="number"
            value={draft.order}
            onChange={(e) => setDraft((d) => ({ ...d, order: Number(e.target.value) || 0 }))}
            className={field}
          />
        </label>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      <button onClick={onSave} disabled={!canSave} className={buttonPrimary}>
        {pending ? "Saving…" : "Save category"}
      </button>
    </div>
  );
}

function IssueForm({
  initial,
  id,
  categories,
  onClose,
  onSaved,
}: {
  initial: KnownIssueInput;
  id: number | null;
  categories: KnownIssueCategory[];
  onClose: () => void;
  onSaved: (issue: KnownIssue) => void;
}) {
  const isNew = id === null;
  const [draft, setDraft] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof KnownIssueInput>(k: K, v: KnownIssueInput[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const title = draft.title.trim();
  const canSave = title.length > 0 && title.length <= 200 && !pending;

  const onSave = () =>
    startTransition(async () => {
      setError(null);
      try {
        const payload = { ...draft, title, description: draft.description?.trim() || null };
        const saved = isNew ? await createStatusIssue(payload) : await updateStatusIssue(id!, payload);
        onSaved(saved);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save this issue.");
      }
    });

  return (
    <div className="border-osrs-gold/40 space-y-4 rounded border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-osrs-gold text-sm font-semibold">{isNew ? "New issue" : "Edit issue"}</h3>
        <button onClick={onClose} className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright">
          Close
        </button>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Title</span>
        <input
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Kill-count not tracked for Yama"
          className={field}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Details (optional, shown under the title)</span>
        <textarea
          value={draft.description ?? ""}
          onChange={(e) => set("description", e.target.value || null)}
          rows={2}
          placeholder="What's affected, and any workaround."
          className={field}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Severity</span>
          <select
            value={draft.severity}
            onChange={(e) => set("severity", e.target.value as IssueSeverity)}
            className={field}
          >
            {ISSUE_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_META[s].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Status</span>
          <select
            value={draft.status}
            onChange={(e) => set("status", e.target.value as IssueStatus)}
            className={field}
          >
            {ISSUE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Category</span>
          <select
            value={draft.category_id}
            onChange={(e) => set("category_id", Number(e.target.value))}
            className={field}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Order (lower first)</span>
          <input
            type="number"
            value={draft.order}
            onChange={(e) => set("order", Number(e.target.value) || 0)}
            className={field}
          />
        </label>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      <button onClick={onSave} disabled={!canSave} className={buttonPrimary}>
        {pending ? "Saving…" : "Save issue"}
      </button>
    </div>
  );
}
