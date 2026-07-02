import type { Metadata } from "next";
import { api } from "@/lib/api";
import { AuditLogViewer } from "@/components/admin/audit-log";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  action?: string;
  actor?: string;
  group?: string;
  q?: string;
  page?: string;
}>;

export default async function AdminAuditPage({ searchParams }: { searchParams: SearchParams }) {
  const { action = "", actor = "", group = "", q = "", page } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);

  let data: Awaited<ReturnType<typeof api.adminAuditLog>> = {
    entries: [],
    meta: { page: pageNum, limit: 50, total: 0 },
  };
  let error: string | null = null;
  try {
    data = await api.adminAuditLog({
      action: action || undefined,
      actorUserId: actor ? Number(actor) : undefined,
      groupId: group ? Number(group) : undefined,
      q: q || undefined,
      page: pageNum,
    });
  } catch (e) {
    error = (e as Error).message || "Failed to load audit log.";
  }

  return (
    <div className="space-y-6">
      <p className="text-osrs-parchment-dark/70 text-sm">
        Every service action, Discord send, data edit, and subscription grant taken from this
        dashboard. Read-only — audit rows cannot be edited or deleted.
      </p>

      {error ? (
        <div className="border-osrs-red/40 bg-osrs-red/10 text-osrs-red rounded border p-4 text-sm">
          {error}
        </div>
      ) : (
        <AuditLogViewer data={data} filters={{ action, actor, group, q }} />
      )}
    </div>
  );
}
