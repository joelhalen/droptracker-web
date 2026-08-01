/**
 * Internal dev tracker — shared types and Zod schemas (the contract).
 *
 * Backs the superadmin project/task board at `/admin/projects`: a lightweight
 * in-house Trello for tracking features (planned / in progress / done) with
 * per-task subtask checklists and Markdown notes. Codebase agents write the
 * same tables through the backend repo's `scripts/project_tracker.py` instead
 * of this UI, so anything rendered here may have been created outside it.
 *
 * See `web_api/routes/dev_tracker.py` for the backend contract.
 */
import { z } from "zod";

export const PROJECT_STATUSES = ["active", "completed", "archived"] as const;
export const TASK_STATUSES = ["planned", "in_progress", "blocked", "done"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const DevSubtaskSchema = z.object({
  id: z.number().int(),
  task_id: z.number().int(),
  title: z.string(),
  done: z.boolean(),
  note: z.string().nullable(),
  order: z.number().int(),
  created_at: z.string().nullable(),
  completed_at: z.string().nullable(),
});
export type DevSubtask = z.infer<typeof DevSubtaskSchema>;

export const DevNoteSchema = z.object({
  id: z.number().int(),
  project_id: z.number().int(),
  task_id: z.number().int().nullable(),
  body_md: z.string(),
  author: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});
export type DevNote = z.infer<typeof DevNoteSchema>;

export const DevTaskSchema = z.object({
  id: z.number().int(),
  project_id: z.number().int(),
  title: z.string(),
  body_md: z.string().nullable(),
  status: z.enum(TASK_STATUSES),
  completion_note: z.string().nullable(),
  order: z.number().int(),
  author: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  subtasks: DevSubtaskSchema.array(),
  notes: DevNoteSchema.array(),
});
export type DevTask = z.infer<typeof DevTaskSchema>;

const projectBase = {
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(PROJECT_STATUSES),
  completion_note: z.string().nullable(),
  order: z.number().int(),
  author: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  completed_at: z.string().nullable(),
};

/** List row: project fields + child counts, no tree. */
export const DevProjectSummarySchema = z.object({
  ...projectBase,
  counts: z.object({
    tasks_total: z.number().int(),
    tasks_done: z.number().int(),
    subtasks_total: z.number().int(),
    subtasks_done: z.number().int(),
    notes: z.number().int(),
  }),
});
export type DevProjectSummary = z.infer<typeof DevProjectSummarySchema>;

/** Detail: full tree. `notes` here are project-level only (task notes ride
 * inside their task). */
export const DevProjectDetailSchema = z.object({
  ...projectBase,
  tasks: DevTaskSchema.array(),
  notes: DevNoteSchema.array(),
});
export type DevProjectDetail = z.infer<typeof DevProjectDetailSchema>;

// --- What the admin forms submit -----------------------------------------

export type DevProjectInput = {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
  completion_note?: string | null;
  order?: number;
};

export type DevTaskInput = {
  title?: string;
  body_md?: string | null;
  status?: TaskStatus;
  completion_note?: string | null;
  order?: number;
};

export type DevSubtaskInput = {
  title?: string;
  done?: boolean;
  note?: string | null;
  order?: number;
};

export type DevNoteInput = {
  body_md?: string;
  /** Create only: attach the note to a task within the project. */
  task_id?: number;
};

// --- Small display helpers (pure; safe anywhere) --------------------------

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};
