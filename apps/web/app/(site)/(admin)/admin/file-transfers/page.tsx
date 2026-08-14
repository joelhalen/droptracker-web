import type { Metadata } from "next";
import { api } from "@/lib/api";
import { requireDeveloper } from "@/lib/auth";
import { AdminFileTransfersPanel } from "@/components/admin/file-transfers-panel";

export const metadata: Metadata = { title: "File transfers" };

// Every load lists live rows whose retention clock is running — never cache.
export const dynamic = "force-dynamic";

/**
 * Staff side of the unlisted /file-transfer hand-off page (web95a). Developer
 * gate rather than superadmin: this is a support tool, and the layout's own
 * `requireDeveloper` already admits the same audience.
 */
export default async function AdminFileTransfersPage() {
  await requireDeveloper("/admin/file-transfers");
  const data = await api.adminFileTransfers();

  return (
    <div className="space-y-4">
      <p className="text-osrs-parchment-dark/70 text-sm">
        Files users have sent from the unlisted{" "}
        <code className="text-osrs-parchment-dark/90">/file-transfer</code> page. Download what they
        sent, or reply with an updated copy — it lands as the next version and they can download
        either. Everything is deleted {data.retention_days} days after its most recent version, and
        none of it is backed up.
      </p>

      <AdminFileTransfersPanel transfers={data.items} retentionDays={data.retention_days} />
    </div>
  );
}
