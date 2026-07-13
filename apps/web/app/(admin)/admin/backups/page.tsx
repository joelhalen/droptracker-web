import type { Metadata } from "next";
import { api } from "@/lib/api";
import { BackupPanel } from "@/components/admin/backup-panel";

export const metadata: Metadata = { title: "Backups" };

export default async function AdminBackupsPage() {
  const overview = await api.adminBackups();

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Nightly database backups (MariaDB + Redis) with offsite copies on Backblaze B2. The timer
        fires daily around 08:30 UTC; local sets are kept {overview.retention.local_days} days and
        offsite copies {overview.retention.remote_days} days.
      </p>
      <BackupPanel overview={overview} />
    </div>
  );
}
