import type { Metadata } from "next";
import { api } from "@/lib/api";
import { LogsViewer } from "@/components/admin/logs-viewer";

export const metadata: Metadata = { title: "Logs" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ source?: string; limit?: string }>;

export default async function AdminLogsPage({ searchParams }: { searchParams: SearchParams }) {
  const { source = "", limit } = await searchParams;
  const limitNum = Math.min(1000, Math.max(1, Number(limit) || 200));

  let entries: Awaited<ReturnType<typeof api.adminLogs>>["entries"] = [];
  let sources: string[] = [];
  let error: string | null = null;
  try {
    const res = await api.adminLogs({ source: source || undefined, limit: limitNum });
    entries = res.entries;
    sources = res.sources;
  } catch (e) {
    error = (e as Error).message || "Failed to load logs.";
  }

  return (
    <div className="space-y-6">
      <p className="text-osrs-parchment-dark/70 text-sm">
        Recent application log output. Filter by source to narrow the stream.
      </p>

      {error ? (
        <div className="border-osrs-red/40 bg-osrs-red/10 text-osrs-red rounded border p-4 text-sm">
          {error}
        </div>
      ) : (
        <LogsViewer entries={entries} sources={sources} source={source} />
      )}
    </div>
  );
}
