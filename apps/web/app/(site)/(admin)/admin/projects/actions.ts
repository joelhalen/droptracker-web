"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";
import type {
  DevNoteInput,
  DevProjectDetail,
  DevProjectInput,
  DevSubtaskInput,
  DevTaskInput,
} from "@/lib/dev-tracker";

/** The list page caches per-request only (force-dynamic), but revalidate it
 * anyway so a back-nav after a mutation can't show a stale summary row. */
function revalidateTracker() {
  revalidatePath("/admin/projects");
}

/** Child mutations return the whole refreshed tree: the detail view swaps its
 * state for the payload wholesale instead of merging rows client-side (server
 * owns completion stamps + the project's "last activity" touch). One extra
 * GET per edit is nothing at this tool's volume. */
async function freshDetail(projectId: number): Promise<DevProjectDetail> {
  const detail = await api.adminDevProject(projectId);
  if (!detail) throw new Error("Project no longer exists.");
  revalidateTracker();
  return detail;
}

// --- Projects --------------------------------------------------------------

export async function createProject(input: DevProjectInput): Promise<DevProjectDetail> {
  await requireSuperadmin("/admin/projects");
  const created = await api.adminCreateDevProject(input);
  revalidateTracker();
  return created;
}

export async function updateProject(
  id: number,
  patch: DevProjectInput,
): Promise<DevProjectDetail> {
  await requireSuperadmin("/admin/projects");
  const updated = await api.adminUpdateDevProject(id, patch);
  revalidateTracker();
  return updated;
}

export async function deleteProject(id: number): Promise<{ ok: true }> {
  await requireSuperadmin("/admin/projects");
  const result = await api.adminDeleteDevProject(id);
  revalidateTracker();
  return result;
}

// --- Tasks -----------------------------------------------------------------

export async function createTask(
  projectId: number,
  input: DevTaskInput,
): Promise<DevProjectDetail> {
  await requireSuperadmin("/admin/projects");
  await api.adminCreateDevTask(projectId, input);
  return freshDetail(projectId);
}

export async function updateTask(
  projectId: number,
  taskId: number,
  patch: DevTaskInput,
): Promise<DevProjectDetail> {
  await requireSuperadmin("/admin/projects");
  await api.adminUpdateDevTask(taskId, patch);
  return freshDetail(projectId);
}

export async function deleteTask(projectId: number, taskId: number): Promise<DevProjectDetail> {
  await requireSuperadmin("/admin/projects");
  await api.adminDeleteDevTask(taskId);
  return freshDetail(projectId);
}

// --- Subtasks --------------------------------------------------------------

export async function createSubtask(
  projectId: number,
  taskId: number,
  input: DevSubtaskInput,
): Promise<DevProjectDetail> {
  await requireSuperadmin("/admin/projects");
  await api.adminCreateDevSubtask(taskId, input);
  return freshDetail(projectId);
}

export async function updateSubtask(
  projectId: number,
  subtaskId: number,
  patch: DevSubtaskInput,
): Promise<DevProjectDetail> {
  await requireSuperadmin("/admin/projects");
  await api.adminUpdateDevSubtask(subtaskId, patch);
  return freshDetail(projectId);
}

export async function deleteSubtask(
  projectId: number,
  subtaskId: number,
): Promise<DevProjectDetail> {
  await requireSuperadmin("/admin/projects");
  await api.adminDeleteDevSubtask(subtaskId);
  return freshDetail(projectId);
}

// --- Notes -----------------------------------------------------------------

export async function createNote(
  projectId: number,
  input: DevNoteInput,
): Promise<DevProjectDetail> {
  await requireSuperadmin("/admin/projects");
  await api.adminCreateDevNote(projectId, input);
  return freshDetail(projectId);
}

export async function updateNote(
  projectId: number,
  noteId: number,
  patch: DevNoteInput,
): Promise<DevProjectDetail> {
  await requireSuperadmin("/admin/projects");
  await api.adminUpdateDevNote(noteId, patch);
  return freshDetail(projectId);
}

export async function deleteNote(projectId: number, noteId: number): Promise<DevProjectDetail> {
  await requireSuperadmin("/admin/projects");
  await api.adminDeleteDevNote(noteId);
  return freshDetail(projectId);
}
