import type { Metadata } from "next";
import { api } from "@/lib/api";
import { TaskLibraryManager } from "@/components/admin/task-library-manager";

export const metadata: Metadata = { title: "Task library" };

// Superadmin write surface over the event task-library presets (the layout
// gates the whole /admin subtree; the API re-checks superadmin on writes).
export const dynamic = "force-dynamic";

export default async function AdminTaskLibraryPage() {
  // Superadmin listing includes every row — public and all groups' private.
  const initial = await api.eventTaskLibrary({}).catch(() => []);
  return <TaskLibraryManager initial={initial} />;
}
