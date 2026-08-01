import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { ProjectDetail } from "@/components/admin/project-detail";

export const metadata: Metadata = { title: "Project" };
export const dynamic = "force-dynamic";

type Params = Promise<{ projectId: string }>;

export default async function AdminProjectDetailPage({ params }: { params: Params }) {
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isInteger(id) || id < 1) notFound();

  let project;
  try {
    project = await api.adminDevProject(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  if (!project) notFound(); // mock-mode fallback returns null

  return (
    <div className="space-y-4">
      <Link
        href={"/admin/projects" as Route}
        className="text-osrs-parchment-dark/70 hover:text-osrs-gold text-sm"
      >
        ← All projects
      </Link>
      <ProjectDetail initial={project} />
    </div>
  );
}
