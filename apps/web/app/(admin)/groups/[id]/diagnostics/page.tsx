import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";

export const metadata: Metadata = { title: "Diagnostics" };

type Params = Promise<{ id: string }>;

function ago(ts: number | null): string {
  if (!ts) return "never";
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function GroupDiagnosticsPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  const diag = await api.diagnostics(groupId);
  const maxActivity = Math.max(1, ...diag.activity_7d.map((d) => d.submissions));

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="border-osrs-bronze/20 rounded border p-3">
          <dt className="text-osrs-parchment-dark/70 text-xs uppercase tracking-wide">Intake</dt>
          <dd
            className={`text-xl font-bold ${diag.intake_healthy ? "text-osrs-green" : "text-osrs-red"}`}
          >
            {diag.intake_healthy ? "Healthy" : "Down"}
          </dd>
        </div>
        <div className="border-osrs-bronze/20 rounded border p-3">
          <dt className="text-osrs-parchment-dark/70 text-xs uppercase tracking-wide">
            Last submission
          </dt>
          <dd className="text-osrs-gold-bright text-xl font-bold">{ago(diag.last_submission_ts)}</dd>
        </div>
        <div className="border-osrs-bronze/20 rounded border p-3">
          <dt className="text-osrs-parchment-dark/70 text-xs uppercase tracking-wide">
            Members synced
          </dt>
          <dd className="text-osrs-gold-bright text-xl font-bold">{ago(diag.members_synced_ts)}</dd>
        </div>
      </dl>

      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
          Submissions (last 7 days)
        </h2>
        <div className="flex h-40 items-end gap-2">
          {diag.activity_7d.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="bg-osrs-bronze hover:bg-osrs-gold w-full rounded-t transition-colors"
                style={{ height: `${(d.submissions / maxActivity) * 100}%` }}
                title={`${d.date}: ${d.submissions}`}
              />
              <span className="text-osrs-parchment-dark/50 text-[10px]">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>

      {diag.warnings.length > 0 && (
        <section>
          <h2 className="text-osrs-red mb-2 text-sm font-semibold">Warnings</h2>
          <ul className="list-inside list-disc text-sm">
            {diag.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
