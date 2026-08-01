import type { Metadata } from "next";
import { api } from "@/lib/api";
import { ProjectTrackerList } from "@/components/admin/project-tracker-list";

export const metadata: Metadata = { title: "Project tracker" };
export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  const projects = await api.adminDevProjects();

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Internal feature/task board — projects hold tasks, tasks hold subtask checklists and
        notes, and anything can be marked complete (with a note) at any level. Codebase agents
        write to the same board via{" "}
        <code className="text-osrs-gold-bright">scripts/project_tracker.py</code> in the backend
        repo, so entries here may have been created outside this UI.
      </p>
      <ProjectTrackerList projects={projects} />
    </div>
  );
}
