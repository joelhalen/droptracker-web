import type { Metadata } from "next";
import { api } from "@/lib/api";
import { TaskLibraryManager } from "@/components/admin/task-library-manager";

export const metadata: Metadata = { title: "Task library" };

// Same surface as /admin/task-library; the moderation layout gates access
// and the API re-checks the moderator role on writes.
export const dynamic = "force-dynamic";

export default async function ModerationTaskLibraryPage() {
  // Staff listing includes every row — public and all groups' private.
  const initial = await api.eventTaskLibrary({}).catch(() => []);
  return <TaskLibraryManager initial={initial} />;
}
