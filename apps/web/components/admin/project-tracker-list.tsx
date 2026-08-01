"use client";

/**
 * Superadmin project tracker — list view. Filter chips + create form +
 * per-project cards with task/subtask progress. The tree itself is edited on
 * the detail page (`project-detail.tsx`).
 */
import { useState, useTransition } from "react";
import type { Route } from "next";
import Link from "next/link";
import { Alert, Badge, EmptyState, fieldInputClass } from "@/components/ui";
import {
  PROJECT_STATUS_LABELS,
  type DevProjectSummary,
  type ProjectStatus,
} from "@/lib/dev-tracker";
import { createProject } from "@/app/(site)/(admin)/admin/projects/actions";

type Filter = ProjectStatus | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "All" },
];

export function projectStatusTone(status: ProjectStatus): "green" | "neutral" | "gold" {
  return status === "completed" ? "green" : status === "archived" ? "neutral" : "gold";
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="bg-osrs-brown-dark/60 h-1.5 w-full overflow-hidden rounded-full">
      <div
        className={`h-full rounded-full ${pct === 100 ? "bg-osrs-green" : "bg-osrs-gold"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ProjectTrackerList({ projects }: { projects: DevProjectSummary[] }) {
  const [list, setList] = useState(projects);
  const [filter, setFilter] = useState<Filter>("active");
  const [creating, setCreating] = useState(false);

  const visible = list.filter((p) => filter === "all" || p.status === filter);
  const countFor = (f: Filter) =>
    f === "all" ? list.length : list.filter((p) => p.status === f).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1 transition-colors ${
                filter === f.key
                  ? "border-osrs-gold/60 bg-osrs-gold/15 text-osrs-gold"
                  : "border-osrs-bronze/30 text-osrs-parchment-dark/70 hover:border-osrs-bronze/60"
              }`}
            >
              {f.label} ({countFor(f.key)})
            </button>
          ))}
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium"
        >
          + New project
        </button>
      </div>

      {creating && (
        <NewProjectForm
          onCreated={(p) => {
            setList((l) => [
              { ...p, counts: { tasks_total: 0, tasks_done: 0, subtasks_total: 0, subtasks_done: 0, notes: 0 } },
              ...l,
            ]);
            setCreating(false);
          }}
          onClose={() => setCreating(false)}
        />
      )}

      {visible.length === 0 ? (
        <EmptyState
          title={filter === "active" ? "No active projects" : "Nothing here"}
          hint="Create a project to start tracking a feature."
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/projects/${p.id}` as Route}
                className="border-osrs-bronze/30 bg-osrs-surface-1/60 hover:border-osrs-gold/50 block rounded-lg border p-4 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-osrs-gold font-semibold">{p.name}</span>
                  {p.status !== "active" && (
                    <Badge tone={projectStatusTone(p.status)}>
                      {PROJECT_STATUS_LABELS[p.status]}
                    </Badge>
                  )}
                </div>
                {p.description && (
                  <p className="text-osrs-parchment-dark/70 mt-1 line-clamp-2 text-sm">
                    {p.description}
                  </p>
                )}
                <div className="mt-3 space-y-1.5">
                  <ProgressBar done={p.counts.tasks_done} total={p.counts.tasks_total} />
                  <div className="text-osrs-parchment-dark/50 flex flex-wrap gap-x-3 text-xs">
                    <span>
                      {p.counts.tasks_total === 0
                        ? "No tasks yet"
                        : `${p.counts.tasks_done}/${p.counts.tasks_total} tasks done`}
                    </span>
                    {p.counts.subtasks_total > 0 && (
                      <span>
                        · {p.counts.subtasks_done}/{p.counts.subtasks_total} subtasks
                      </span>
                    )}
                    {p.counts.notes > 0 && <span>· {p.counts.notes} notes</span>}
                    <span>· updated {shortDate(p.updated_at)}</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewProjectForm({
  onCreated,
  onClose,
}: {
  onCreated: (p: { id: number } & Omit<DevProjectSummary, "counts">) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSave = () =>
    startTransition(async () => {
      setError(null);
      try {
        const created = await createProject({
          name: name.trim(),
          description: description.trim() || null,
        });
        onCreated(created);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't create the project.");
      }
    });

  return (
    <div className="border-osrs-gold/40 space-y-3 rounded border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-osrs-gold text-sm font-semibold">New project</h3>
        <button
          onClick={onClose}
          className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
        >
          Close
        </button>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name (e.g. Recap delivery v2)"
        className={`${fieldInputClass} w-full`}
        autoFocus
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What is this project about? (optional)"
        rows={2}
        className={`${fieldInputClass} w-full`}
      />
      {error && <Alert variant="error">{error}</Alert>}
      <button
        onClick={onSave}
        disabled={name.trim() === "" || pending}
        className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create project"}
      </button>
    </div>
  );
}
