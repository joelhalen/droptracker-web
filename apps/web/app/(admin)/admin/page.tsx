import type { Metadata, Route } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { formatRelativeTime } from "@/lib/format";

export const metadata: Metadata = { title: "Site admin" };

// Reads happen server-side; the KPI snapshot is cached lightly by the API.
export const dynamic = "force-dynamic";

function formatGeneratedAt(value: number | string): string {
  const ms = typeof value === "number" ? value * 1000 : Date.parse(value);
  if (!Number.isFinite(ms)) return String(value);
  return new Date(ms).toLocaleString();
}

async function KpiGrid() {
  let stats: Awaited<ReturnType<typeof api.adminOverview>>["stats"] = [];
  let generatedAt: number | string | null = null;
  let errored = false;
  try {
    const overview = await api.adminOverview();
    stats = overview.stats;
    generatedAt = overview.generated_at;
  } catch {
    errored = true;
  }

  if (errored) {
    return (
      <div className="border-osrs-red/40 bg-osrs-red/10 text-osrs-red rounded border p-4 text-sm">
        Could not load overview stats. The API may be unavailable.
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="border-osrs-bronze/20 text-osrs-parchment-dark/60 rounded border p-4 text-sm">
        No stats reported yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.key} className="border-osrs-bronze/20 rounded border p-4">
            <dt className="text-osrs-parchment-dark/70 text-xs uppercase tracking-wide">{s.label}</dt>
            <dd className="text-osrs-gold-bright mt-1 text-2xl font-bold tabular-nums">{s.value}</dd>
            {s.hint && <p className="text-osrs-parchment-dark/50 mt-1 text-xs">{s.hint}</p>}
          </div>
        ))}
      </dl>
      {generatedAt != null && (
        <p className="text-osrs-parchment-dark/40 text-right text-xs">
          Snapshot: {formatGeneratedAt(generatedAt)}
        </p>
      )}
    </div>
  );
}

const SERVICE_DOT: Record<string, string> = {
  running: "bg-osrs-green",
  stopped: "bg-osrs-parchment-dark/40",
  failed: "bg-osrs-red",
  unknown: "bg-osrs-parchment-dark/40",
};

/** Compact health strip: is anything on fire? Everything links to its page. */
async function SystemHealth() {
  const [services, backups] = await Promise.allSettled([api.adminServices(), api.adminBackups()]);

  return (
    <div className="border-osrs-bronze/20 flex flex-wrap items-center gap-x-6 gap-y-2 rounded border px-4 py-3 text-sm">
      {services.status === "fulfilled" ? (
        <Link href={"/admin/services" as Route} className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {services.value.map((s) => (
            <span key={s.unit} className="flex items-center gap-1.5" title={s.unit}>
              <span
                className={`inline-block size-2 rounded-full ${SERVICE_DOT[s.status] ?? SERVICE_DOT.unknown}`}
              />
              <span
                className={
                  s.status === "failed" ? "text-osrs-red" : "text-osrs-parchment-dark/80"
                }
              >
                {s.name}
              </span>
            </span>
          ))}
        </Link>
      ) : (
        <span className="text-osrs-parchment-dark/50">Service status unavailable</span>
      )}

      <span className="border-osrs-bronze/30 hidden h-4 border-l sm:inline-block" aria-hidden />

      {backups.status === "fulfilled" ? (
        <Link href={"/admin/backups" as Route} className="flex items-center gap-1.5">
          {backups.value.running ? (
            <span className="text-osrs-gold">● Backup running…</span>
          ) : backups.value.last_run?.success ? (
            <span className="text-osrs-green">✓ Backups</span>
          ) : (
            <span className="text-osrs-red">✗ Backups</span>
          )}
          <span className="text-osrs-parchment-dark/60">
            {backups.value.last_run
              ? `last ${formatRelativeTime(backups.value.last_run.started)}`
              : "never ran"}
          </span>
        </Link>
      ) : (
        <span className="text-osrs-parchment-dark/50">Backup status unavailable</span>
      )}
    </div>
  );
}

export default function SuperadminOverview() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">At a glance</h2>
        <div className="space-y-4">
          <SystemHealth />
          <KpiGrid />
        </div>
      </section>

      {ADMIN_SECTIONS.map((section) => (
        <section key={section.label}>
          <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
            {section.label}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href as Route}
                className="border-osrs-bronze/20 hover:border-osrs-gold/50 rounded border p-3 transition-colors"
              >
                <div className="text-osrs-gold-bright text-sm font-medium">{item.label}</div>
                <div className="text-osrs-parchment-dark/70 mt-0.5 text-xs">{item.desc}</div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
