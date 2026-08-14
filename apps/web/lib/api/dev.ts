import { apiGet, apiSend, withFallback } from "./_client";
import {
  DevNoteSchema,
  DevProjectDetailSchema,
  DevProjectSummarySchema,
  DevSubtaskSchema,
  DevTaskSchema,
  type DevNote,
  type DevNoteInput,
  type DevProjectDetail,
  type DevProjectInput,
  type DevProjectSummary,
  type DevSubtask,
  type DevSubtaskInput,
  type DevTask,
  type DevTaskInput,
} from "../dev-tracker";

export const devApi = {

  // --- Dev tracker (internal project/task board, superadmin only) --------
  async adminDevProjects(): Promise<DevProjectSummary[]> {
    return withFallback(
      async () =>
        DevProjectSummarySchema.array().parse(
          await apiGet(`/admin/dev/projects`, { authed: true }),
        ),
      () => [],
    );
  },


  async adminDevProject(id: number): Promise<DevProjectDetail | null> {
    return withFallback(
      async () =>
        DevProjectDetailSchema.parse(await apiGet(`/admin/dev/projects/${id}`, { authed: true })),
      () => null,
    );
  },


  async adminCreateDevProject(input: DevProjectInput): Promise<DevProjectDetail> {
    return DevProjectDetailSchema.parse(await apiSend("POST", `/admin/dev/projects`, input));
  },


  async adminUpdateDevProject(id: number, patch: DevProjectInput): Promise<DevProjectDetail> {
    return DevProjectDetailSchema.parse(await apiSend("PATCH", `/admin/dev/projects/${id}`, patch));
  },


  async adminDeleteDevProject(id: number): Promise<{ ok: true }> {
    await apiSend("DELETE", `/admin/dev/projects/${id}`, {});
    return { ok: true } as const;
  },


  async adminCreateDevTask(projectId: number, input: DevTaskInput): Promise<DevTask> {
    return DevTaskSchema.parse(await apiSend("POST", `/admin/dev/projects/${projectId}/tasks`, input));
  },


  async adminUpdateDevTask(id: number, patch: DevTaskInput): Promise<DevTask> {
    return DevTaskSchema.parse(await apiSend("PATCH", `/admin/dev/tasks/${id}`, patch));
  },


  async adminDeleteDevTask(id: number): Promise<{ ok: true }> {
    await apiSend("DELETE", `/admin/dev/tasks/${id}`, {});
    return { ok: true } as const;
  },


  async adminCreateDevSubtask(taskId: number, input: DevSubtaskInput): Promise<DevSubtask> {
    return DevSubtaskSchema.parse(await apiSend("POST", `/admin/dev/tasks/${taskId}/subtasks`, input));
  },


  async adminUpdateDevSubtask(id: number, patch: DevSubtaskInput): Promise<DevSubtask> {
    return DevSubtaskSchema.parse(await apiSend("PATCH", `/admin/dev/subtasks/${id}`, patch));
  },


  async adminDeleteDevSubtask(id: number): Promise<{ ok: true }> {
    await apiSend("DELETE", `/admin/dev/subtasks/${id}`, {});
    return { ok: true } as const;
  },


  async adminCreateDevNote(projectId: number, input: DevNoteInput): Promise<DevNote> {
    return DevNoteSchema.parse(await apiSend("POST", `/admin/dev/projects/${projectId}/notes`, input));
  },


  async adminUpdateDevNote(id: number, patch: DevNoteInput): Promise<DevNote> {
    return DevNoteSchema.parse(await apiSend("PATCH", `/admin/dev/notes/${id}`, patch));
  },


  async adminDeleteDevNote(id: number): Promise<{ ok: true }> {
    await apiSend("DELETE", `/admin/dev/notes/${id}`, {});
    return { ok: true } as const;
  },
};
