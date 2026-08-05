import type { Metadata } from "next";
import { api } from "@/lib/api";
import { StatusManager } from "@/components/admin/status-manager";
import { requireDeveloper } from "@/lib/auth";

export const metadata: Metadata = { title: "Status & issues" };
export const dynamic = "force-dynamic";

export default async function AdminStatusPage() {
  await requireDeveloper("/admin/status");
  const [summary, categories] = await Promise.all([api.statusSummary(), api.adminStatusIssues()]);

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Live health of the submission pipeline, and the known-issues board. Everything here is
        mirrored into the <span className="text-osrs-gold-bright">#status</span> Discord channel by
        the core bot — issue changes appear there within a minute, no deploy needed.
      </p>
      <StatusManager services={summary.services} categories={categories} />
    </div>
  );
}
