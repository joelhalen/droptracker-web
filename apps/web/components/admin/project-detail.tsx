"use client";

/**
 * Superadmin project tracker — detail/tree editor for one project.
 *
 * Every mutation goes through a server action that returns the whole
 * refreshed tree (see actions.ts), and the component swaps its state for the
 * payload wholesale — no client-side row merging, so server-owned fields
 * (completion stamps, "last activity" touches, agent-written rows) can never
 * drift from what's shown.
 */
import { useState, useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Alert, Badge, EmptyState, Input, Textarea } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type DevNote,
  type DevProjectDetail,
  type DevSubtask,
  type DevTask,
  type ProjectStatus,
  type TaskStatus,
} from "@/lib/dev-tracker";
import {
  createNote,
  createSubtask,
  createTask,
  deleteNote,
  deleteProject,
  deleteSubtask,
  deleteTask,
  updateNote,
  updateProject,
  updateSubtask,
  updateTask,
} from "@/app/(site)/(admin)/admin/projects/actions";

const TASK_TONES: Record<TaskStatus, "neutral" | "sky" | "red" | "green"> = {
  planned: "neutral",
  in_progress: "sky",
  blocked: "red",
  done: "green",
};

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ProjectDetail({ initial }: { initial: DevProjectDetail }) {
  const router = useRouter();
  const [project, setProject] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /** Run a mutation that resolves to the fresh tree. */
  const run = (fn: () => Promise<DevProjectDetail>) =>
    startTransition(async () => {
      setError(null);
      try {
        setProject(await fn());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });

  const doDeleteProject = () =>
    startTransition(async () => {
      setError(null);
      try {
        await deleteProject(project.id);
        router.push("/admin/projects" as Route);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete the project.");
      }
    });

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      <ProjectHeader
        project={project}
        pending={pending}
        onPatch={(patch) => run(() => updateProject(project.id, patch))}
        onDelete={doDeleteProject}
      />

      <section className="space-y-2">
        <h3 className="text-osrs-gold text-sm font-semibold tracking-wide uppercase">
          Project notes
        </h3>
        <NoteList
          notes={project.notes}
          pending={pending}
          onAdd={(body) => run(() => createNote(project.id, { body_md: body }))}
          onUpdate={(id, body) => run(() => updateNote(project.id, id, { body_md: body }))}
          onDelete={(id) => run(() => deleteNote(project.id, id))}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-osrs-gold text-sm font-semibold tracking-wide uppercase">Tasks</h3>
        {project.tasks.length === 0 && (
          <EmptyState title="No tasks yet" hint="Break the project down below." />
        )}
        {project.tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            pending={pending}
            onPatch={(patch) => run(() => updateTask(project.id, t.id, patch))}
            onDelete={() => run(() => deleteTask(project.id, t.id))}
            onAddSubtask={(title) => run(() => createSubtask(project.id, t.id, { title }))}
            onPatchSubtask={(sid, patch) => run(() => updateSubtask(project.id, sid, patch))}
            onDeleteSubtask={(sid) => run(() => deleteSubtask(project.id, sid))}
            onAddNote={(body) => run(() => createNote(project.id, { body_md: body, task_id: t.id }))}
            onUpdateNote={(nid, body) => run(() => updateNote(project.id, nid, { body_md: body }))}
            onDeleteNote={(nid) => run(() => deleteNote(project.id, nid))}
          />
        ))}
        <AddTaskForm
          pending={pending}
          onAdd={(title, body) =>
            run(() => createTask(project.id, { title, body_md: body || null }))
          }
        />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Header: name/description/status/completion + delete                       */
/* ------------------------------------------------------------------------ */

function ProjectHeader({
  project,
  pending,
  onPatch,
  onDelete,
}: {
  project: DevProjectDetail;
  pending: boolean;
  onPatch: (patch: {
    name?: string;
    description?: string | null;
    status?: ProjectStatus;
    completion_note?: string | null;
  }) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveEdit = () => {
    onPatch({ name: name.trim(), description: desc.trim() || null });
    setEditing(false);
  };

  return (
    <header className="border-osrs-bronze/30 bg-osrs-surface-1/60 space-y-3 rounded-lg border p-4">
      {editing ? (
        <div className="space-y-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
          <Textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            placeholder="Description (optional)"
            className="w-full"
          />
          <div className="flex gap-3 text-sm">
            <button
              onClick={saveEdit}
              disabled={name.trim() === "" || pending}
              className="text-osrs-gold-bright font-medium hover:underline disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-osrs-gold text-xl font-bold">{project.name}</h2>
            <Badge tone={project.status === "completed" ? "green" : project.status === "archived" ? "neutral" : "gold"}>
              {PROJECT_STATUS_LABELS[project.status]}
            </Badge>
            <button
              onClick={() => {
                setName(project.name);
                setDesc(project.description ?? "");
                setEditing(true);
              }}
              className="text-osrs-parchment-dark/60 text-xs hover:text-osrs-gold-bright"
            >
              Edit
            </button>
          </div>
          {project.description && (
            <p className="text-osrs-parchment-dark/80 text-sm">{project.description}</p>
          )}
        </>
      )}

      <div className="text-osrs-parchment-dark/50 text-xs">
        Created {shortDate(project.created_at)}
        {project.author ? ` by ${project.author}` : ""} · last activity{" "}
        {shortDate(project.updated_at)}
        {project.completed_at ? ` · completed ${shortDate(project.completed_at)}` : ""}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {PROJECT_STATUSES.filter((s) => s !== project.status).map((s) => (
          <button
            key={s}
            disabled={pending}
            onClick={() => onPatch({ status: s })}
            className="border-osrs-bronze/40 hover:border-osrs-gold/60 hover:text-osrs-gold rounded border px-2.5 py-1 disabled:opacity-50"
          >
            {s === "completed" ? "Mark completed" : s === "archived" ? "Archive" : "Reactivate"}
          </button>
        ))}
        <span className="grow" />
        {confirmDelete ? (
          <>
            <span className="text-osrs-red">Delete project and everything in it?</span>
            <button
              onClick={onDelete}
              disabled={pending}
              className="text-osrs-red font-semibold disabled:opacity-50"
            >
              {pending ? "…" : "Confirm"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-osrs-parchment-dark/50 hover:text-osrs-red"
          >
            Delete project
          </button>
        )}
      </div>

      <CompletionNote
        visible={project.status === "completed"}
        value={project.completion_note}
        pending={pending}
        onSave={(note) => onPatch({ completion_note: note })}
      />
    </header>
  );
}

/** Shown for completed projects/done tasks: display + edit the wrap-up note. */
function CompletionNote({
  visible,
  value,
  pending,
  onSave,
}: {
  visible: boolean;
  value: string | null;
  pending: boolean;
  onSave: (note: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  if (!visible) return null;

  if (!editing) {
    return (
      <div className="border-osrs-green/30 bg-osrs-green/5 rounded border px-3 py-2 text-sm">
        <span className="text-osrs-green font-medium">Completion note: </span>
        <span className="text-osrs-parchment-dark/80">{value || "(none)"} </span>
        <button
          onClick={() => {
            setDraft(value ?? "");
            setEditing(true);
          }}
          className="text-osrs-parchment-dark/50 text-xs hover:text-osrs-gold-bright"
        >
          edit
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        placeholder="What shipped / how it wrapped up"
        className="w-full"
        autoFocus
      />
      <div className="flex gap-3 text-sm">
        <button
          onClick={() => {
            onSave(draft.trim() || null);
            setEditing(false);
          }}
          disabled={pending}
          className="text-osrs-gold-bright font-medium hover:underline disabled:opacity-50"
        >
          Save note
        </button>
        <button
          onClick={() => setEditing(false)}
          className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Task card                                                                 */
/* ------------------------------------------------------------------------ */

function TaskCard({
  task,
  pending,
  onPatch,
  onDelete,
  onAddSubtask,
  onPatchSubtask,
  onDeleteSubtask,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
}: {
  task: DevTask;
  pending: boolean;
  onPatch: (patch: {
    title?: string;
    body_md?: string | null;
    status?: TaskStatus;
    completion_note?: string | null;
  }) => void;
  onDelete: () => void;
  onAddSubtask: (title: string) => void;
  onPatchSubtask: (id: number, patch: { done?: boolean; note?: string | null }) => void;
  onDeleteSubtask: (id: number) => void;
  onAddNote: (body: string) => void;
  onUpdateNote: (id: number, body: string) => void;
  onDeleteNote: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(task.status !== "done");
  const [editingBody, setEditingBody] = useState(false);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [bodyDraft, setBodyDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");

  const doneSubtasks = task.subtasks.filter((s) => s.done).length;

  return (
    <div className="border-osrs-bronze/30 bg-osrs-surface-1/40 rounded-lg border">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2 p-3">
        <select
          value={task.status}
          disabled={pending}
          onChange={(e) => onPatch({ status: e.target.value as TaskStatus })}
          className="border-osrs-bronze/40 bg-osrs-brown-dark/40 rounded border px-1.5 py-0.5 text-xs outline-none"
          aria-label="Task status"
        >
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <Badge tone={TASK_TONES[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>

        {titleDraft !== null ? (
          <Input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && titleDraft.trim() !== "") {
                onPatch({ title: titleDraft.trim() });
                setTitleDraft(null);
              }
              if (e.key === "Escape") setTitleDraft(null);
            }}
            onBlur={() => setTitleDraft(null)}
            className="min-w-40 grow py-0.5 text-sm"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setTitleDraft(task.title)}
            title="Click to rename"
            className={`text-left text-sm font-medium ${task.status === "done" ? "text-osrs-parchment-dark/50 line-through" : "text-osrs-parchment"}`}
          >
            {task.title}
          </button>
        )}

        <span className="grow" />
        {task.subtasks.length > 0 && (
          <span className="text-osrs-parchment-dark/50 text-xs">
            {doneSubtasks}/{task.subtasks.length}
          </span>
        )}
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="text-osrs-parchment-dark/60 px-1 text-xs hover:text-osrs-gold-bright"
        >
          {expanded ? "▾" : "▸"}
        </button>
      </div>

      {expanded && (
        <div className="border-osrs-bronze/20 space-y-4 border-t p-3">
          {/* Body / plan */}
          {editingBody ? (
            <div className="space-y-2">
              <Textarea
                value={bodyDraft}
                onChange={(e) => setBodyDraft(e.target.value)}
                rows={5}
                placeholder="Plan / details (Markdown)"
                className="w-full"
                autoFocus
              />
              <div className="flex gap-3 text-sm">
                <button
                  onClick={() => {
                    onPatch({ body_md: bodyDraft.trim() || null });
                    setEditingBody(false);
                  }}
                  disabled={pending}
                  className="text-osrs-gold-bright font-medium hover:underline disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingBody(false)}
                  className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              {task.body_md ? (
                <Markdown className="text-sm">{task.body_md}</Markdown>
              ) : (
                <span className="text-osrs-parchment-dark/40 text-sm italic">No details yet.</span>
              )}{" "}
              <button
                onClick={() => {
                  setBodyDraft(task.body_md ?? "");
                  setEditingBody(true);
                }}
                className="text-osrs-parchment-dark/50 text-xs hover:text-osrs-gold-bright"
              >
                edit
              </button>
            </div>
          )}

          <CompletionNote
            visible={task.status === "done"}
            value={task.completion_note}
            pending={pending}
            onSave={(note) => onPatch({ completion_note: note })}
          />

          {/* Subtasks */}
          <div className="space-y-1">
            {task.subtasks.map((s) => (
              <SubtaskRow
                key={s.id}
                subtask={s}
                pending={pending}
                onPatch={(patch) => onPatchSubtask(s.id, patch)}
                onDelete={() => onDeleteSubtask(s.id)}
              />
            ))}
            <div className="flex gap-2 pt-1">
              <Input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSubtask.trim() !== "") {
                    onAddSubtask(newSubtask.trim());
                    setNewSubtask("");
                  }
                }}
                placeholder="Add a checklist item and press Enter"
                className="w-full py-1 text-xs"
              />
            </div>
          </div>

          {/* Task notes */}
          <NoteList
            notes={task.notes}
            compact
            pending={pending}
            onAdd={onAddNote}
            onUpdate={onUpdateNote}
            onDelete={onDeleteNote}
          />

          {/* Footer: meta + delete */}
          <div className="text-osrs-parchment-dark/40 flex items-center gap-2 text-xs">
            <span>
              Added {shortDate(task.created_at)}
              {task.author ? ` by ${task.author}` : ""}
              {task.completed_at ? ` · done ${shortDate(task.completed_at)}` : ""}
            </span>
            <span className="grow" />
            {confirmDelete ? (
              <>
                <button
                  onClick={onDelete}
                  disabled={pending}
                  className="text-osrs-red font-semibold disabled:opacity-50"
                >
                  {pending ? "…" : "Confirm delete"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="hover:text-osrs-gold-bright"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="hover:text-osrs-red">
                Delete task
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SubtaskRow({
  subtask,
  pending,
  onPatch,
  onDelete,
}: {
  subtask: DevSubtask;
  pending: boolean;
  onPatch: (patch: { done?: boolean; note?: string | null }) => void;
  onDelete: () => void;
}) {
  const [noteDraft, setNoteDraft] = useState<string | null>(null);

  return (
    <div className="group flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={subtask.done}
        disabled={pending}
        onChange={(e) => onPatch({ done: e.target.checked })}
      />
      <span
        className={
          subtask.done ? "text-osrs-parchment-dark/50 line-through" : "text-osrs-parchment"
        }
      >
        {subtask.title}
      </span>
      {noteDraft !== null ? (
        <Input
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onPatch({ note: noteDraft.trim() || null });
              setNoteDraft(null);
            }
            if (e.key === "Escape") setNoteDraft(null);
          }}
          onBlur={() => setNoteDraft(null)}
          placeholder="note + Enter"
          className="grow py-0.5 text-xs"
          autoFocus
        />
      ) : (
        <button
          onClick={() => setNoteDraft(subtask.note ?? "")}
          className="text-osrs-parchment-dark/50 text-xs italic hover:text-osrs-gold-bright"
        >
          {subtask.note ? `(${subtask.note})` : "+ note"}
        </button>
      )}
      <span className="grow" />
      <button
        onClick={onDelete}
        disabled={pending}
        title="Delete subtask"
        className="text-osrs-parchment-dark/30 text-xs opacity-0 group-hover:opacity-100 hover:text-osrs-red disabled:opacity-50"
      >
        ✕
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Notes (shared by project + task levels)                                   */
/* ------------------------------------------------------------------------ */

function NoteList({
  notes,
  compact = false,
  pending,
  onAdd,
  onUpdate,
  onDelete,
}: {
  notes: DevNote[];
  compact?: boolean;
  pending: boolean;
  onAdd: (body: string) => void;
  onUpdate: (id: number, body: string) => void;
  onDelete: (id: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-2">
      {notes.map((n) => (
        <NoteRow
          key={n.id}
          note={n}
          pending={pending}
          onUpdate={(body) => onUpdate(n.id, body)}
          onDelete={() => onDelete(n.id)}
        />
      ))}
      {adding ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={compact ? 2 : 3}
            placeholder="Note (Markdown)"
            className="w-full"
            autoFocus
          />
          <div className="flex gap-3 text-sm">
            <button
              onClick={() => {
                if (draft.trim() === "") return;
                onAdd(draft.trim());
                setDraft("");
                setAdding(false);
              }}
              disabled={pending || draft.trim() === ""}
              className="text-osrs-gold-bright font-medium hover:underline disabled:opacity-50"
            >
              Add note
            </button>
            <button
              onClick={() => setAdding(false)}
              className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-osrs-parchment-dark/50 text-xs hover:text-osrs-gold-bright"
        >
          + Add note
        </button>
      )}
    </div>
  );
}

function NoteRow({
  note,
  pending,
  onUpdate,
  onDelete,
}: {
  note: DevNote;
  pending: boolean;
  onUpdate: (body: string) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft !== null) {
    return (
      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="w-full"
          autoFocus
        />
        <div className="flex gap-3 text-sm">
          <button
            onClick={() => {
              if (draft.trim() === "") return;
              onUpdate(draft.trim());
              setDraft(null);
            }}
            disabled={pending || draft.trim() === ""}
            className="text-osrs-gold-bright font-medium hover:underline disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => setDraft(null)}
            className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group border-osrs-bronze/20 bg-osrs-surface-2/30 rounded border px-3 py-2">
      <Markdown className="text-sm">{note.body_md}</Markdown>
      <div className="text-osrs-parchment-dark/40 mt-1 flex items-center gap-2 text-xs">
        <span>
          {note.author || "unknown"} · {shortDate(note.created_at)}
        </span>
        <span className="grow" />
        <button
          onClick={() => setDraft(note.body_md)}
          className="opacity-0 group-hover:opacity-100 hover:text-osrs-gold-bright"
        >
          edit
        </button>
        <button
          onClick={onDelete}
          disabled={pending}
          className="opacity-0 group-hover:opacity-100 hover:text-osrs-red disabled:opacity-50"
        >
          delete
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Add task                                                                  */
/* ------------------------------------------------------------------------ */

function AddTaskForm({
  pending,
  onAdd,
}: {
  pending: boolean;
  onAdd: (title: string, body: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="border-osrs-bronze/40 text-osrs-parchment-dark/70 hover:border-osrs-gold/60 hover:text-osrs-gold w-full rounded-lg border border-dashed px-3 py-2 text-sm"
      >
        + Add task
      </button>
    );
  }

  return (
    <div className="border-osrs-gold/40 space-y-2 rounded-lg border p-3">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="w-full"
        autoFocus
      />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Plan / details (Markdown, optional)"
        className="w-full"
      />
      <div className="flex gap-3 text-sm">
        <button
          onClick={() => {
            onAdd(title.trim(), body.trim());
            setTitle("");
            setBody("");
            setOpen(false);
          }}
          disabled={title.trim() === "" || pending}
          className="text-osrs-gold-bright font-medium hover:underline disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add task"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
