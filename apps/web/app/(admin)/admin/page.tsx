import type { Metadata, Route } from "next";
import Link from "next/link";
import { api } from "@/lib/api";

export const metadata: Metadata = { title: "Site admin" };

// Reads happen server-side; the KPI snapshot is cached lightly by the API.
export const dynamic = "force-dynamic";

// `href` cast to `Route` at render time (see note in layout.tsx).
const CARDS: { href: string; title: string; desc: string }[] = [
  { href: "/admin/data", title: "Data viewer", desc: "Browse and edit whitelisted records safely." },
  { href: "/admin/logs", title: "Logs", desc: "Tail application logs by source." },
  { href: "/admin/groups", title: "Groups", desc: "Introspect groups; grant/revoke comped subs." },
  { href: "/admin/users", title: "Users", desc: "Look up a user; manage superadmin access." },
  { href: "/admin/audit", title: "Audit log", desc: "Browse every admin action taken on the site." },
  { href: "/admin/announcements", title: "Global news", desc: "Publish site-wide announcements." },
  { href: "/admin/docs", title: "Docs", desc: "Add, edit, and delete documentation pages." },
  { href: "/admin/discord", title: "Discord sender", desc: "Send a message to any channel via the bot." },
  { href: "/admin/services", title: "Services", desc: "Start/stop/restart backend services; view logs." },
  { href: "/admin/lookup", title: "Lookup", desc: "Cross-content search across players, groups, drops…" },
  { href: "/admin/tiers", title: "Subscription tiers", desc: "Create and edit premium tiers." },
];

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

export default function SuperadminOverview() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">At a glance</h2>
        <KpiGrid />
      </section>

      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">Tools</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {CARDS.map((c) => (
            <Link
              key={c.href}
              href={c.href as Route}
              className="border-osrs-bronze/20 hover:border-osrs-gold/50 rounded border p-4 transition-colors"
            >
              <div className="text-osrs-gold-bright font-medium">{c.title}</div>
              <div className="text-osrs-parchment-dark/70 mt-1 text-sm">{c.desc}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
