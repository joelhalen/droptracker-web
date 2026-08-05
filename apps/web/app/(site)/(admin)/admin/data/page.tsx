import type { Metadata, Route } from "next";
import Link from "next/link";
import { ADMIN_DATA_ENTITIES, api, type AdminDataEntity } from "@/lib/api";
import { DataBrowser } from "@/components/admin/data-browser";
import { requireDeveloper } from "@/lib/auth";

export const metadata: Metadata = { title: "Data viewer" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ entity?: string; q?: string; page?: string }>;

const ENTITY_LABELS: Record<AdminDataEntity, string> = {
  players: "Players",
  groups: "Groups",
  users: "Users",
  group_configurations: "Group configs",
  subscription_tiers: "Tiers",
  group_subscriptions: "Group subs",
  user_subscriptions: "User subs",
  audit_log: "Audit log",
  announcements: "Announcements",
  notification_queue: "Notif. queue",
  discord_outbox: "Discord outbox",
};

// Mirrors the backend registry's developer_readable flags (admin_registry.py):
// developers browse these read-only; everything else is superadmin-only.
const DEVELOPER_ENTITIES = ["players", "groups"] as const satisfies readonly AdminDataEntity[];

function isEntity(v: string | undefined): v is AdminDataEntity {
  return !!v && (ADMIN_DATA_ENTITIES as readonly string[]).includes(v);
}

export default async function AdminDataPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireDeveloper("/admin/data");
  const entities = user.is_superadmin ? ADMIN_DATA_ENTITIES : DEVELOPER_ENTITIES;
  const { entity: rawEntity, q = "", page = "1" } = await searchParams;
  const requested: AdminDataEntity = isEntity(rawEntity) ? rawEntity : entities[0];
  const entity: AdminDataEntity = (entities as readonly AdminDataEntity[]).includes(requested)
    ? requested
    : entities[0];
  const pageNum = Math.max(1, Number(page) || 1);

  let data: Awaited<ReturnType<typeof api.adminDataList>> | null = null;
  let error: string | null = null;
  try {
    data = await api.adminDataList(entity, { q, page: pageNum, limit: 25 });
  } catch (e) {
    error = (e as Error).message || "Failed to load data.";
  }

  return (
    <div className="space-y-6">
      <p className="text-osrs-parchment-dark/70 text-sm">
        {user.is_superadmin
          ? "Browse and edit a curated set of tables. Only whitelisted, non-sensitive fields are editable; every change is recorded in the audit log."
          : "Browse a curated, read-only set of tables. Entities carrying PII or billing data are superadmin-only."}
      </p>

      <nav className="border-osrs-bronze/30 flex flex-wrap gap-1 border-b pb-2 text-sm">
        {entities.map((e) => {
          const active = e === entity;
          return (
            <Link
              key={e}
              href={`/admin/data?entity=${e}` as Route}
              className={`rounded px-3 py-1.5 ${
                active
                  ? "bg-osrs-bronze text-osrs-parchment"
                  : "hover:bg-osrs-bronze/30 text-osrs-parchment-dark/80"
              }`}
            >
              {ENTITY_LABELS[e]}
            </Link>
          );
        })}
      </nav>

      {error ? (
        <div className="border-osrs-red/40 bg-osrs-red/10 text-osrs-red rounded border p-4 text-sm">
          {error}
        </div>
      ) : data ? (
        <DataBrowser data={data} q={q} />
      ) : null}
    </div>
  );
}
