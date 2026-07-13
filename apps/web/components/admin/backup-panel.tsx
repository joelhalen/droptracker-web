"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BackupOffsite, BackupOverview, BackupSet } from "@droptracker/api-types";
import {
  fetchBackupLogs,
  fetchOffsiteBackups,
  runBackupNow,
} from "@/app/(admin)/admin/backups/actions";
import { StatTile } from "@/components/ui";
import { formatBytes, formatRelativeTime } from "@/lib/format";

const SET_STATUS: Record<BackupSet["status"], { label: string; className: string }> = {
  complete: { label: "Complete", className: "bg-osrs-green/15 text-osrs-green" },
  in_progress: { label: "In progress", className: "bg-osrs-gold/15 text-osrs-gold" },
  incomplete: { label: "Incomplete", className: "bg-osrs-red/15 text-osrs-red" },
};

function formatUntil(unixSeconds: number | null): string {
  if (!unixSeconds) return "—";
  const diff = unixSeconds - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "due now";
  if (diff < 3600) return `in ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `in ${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  return `in ${Math.floor(diff / 86400)}d`;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function utcDateTime(unixSeconds: number | null): string {
  if (!unixSeconds) return "—";
  return `${new Date(unixSeconds * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function BackupPanel({ overview }: { overview: BackupOverview }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRun, setConfirmRun] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[] | null>(null);
  const [offsite, setOffsite] = useState<
    { state: "loading" } | { state: "error"; error: string } | { state: "ok"; data: BackupOffsite }
  >({ state: "loading" });

  // The offsite listing hits B2 over the network — load it after first paint
  // instead of blocking the page render.
  useEffect(() => {
    let cancelled = false;
    fetchOffsiteBackups().then((result) => {
      if (cancelled) return;
      setOffsite(result.ok ? { state: "ok", data: result.data } : { state: "error", error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const runNow = () => {
    setError(null);
    setBusy("run");
    setConfirmRun(false);
    startTransition(async () => {
      const result = await runBackupNow();
      if (!result.ok) setError(result.error);
      setBusy(null);
    });
  };

  const viewLogs = () => {
    setBusy("logs");
    startTransition(async () => {
      const result = await fetchBackupLogs();
      setLogs(result.lines);
      setBusy(null);
    });
  };

  const { last_run: lastRun, timer, disk, sets, running } = overview;
  const lastStatus = running
    ? { text: "Running…", className: "text-osrs-gold" }
    : !lastRun
      ? { text: "Never ran", className: "text-osrs-red" }
      : lastRun.success
        ? { text: "✓ Success", className: "text-osrs-green" }
        : { text: `✗ ${lastRun.result}`, className: "text-osrs-red" };

  const btn = "rounded px-2.5 py-1 text-xs disabled:opacity-50";

  return (
    <div className="space-y-6">
      {!timer.enabled && (
        <div className="bg-osrs-red/10 border-osrs-red/40 text-osrs-red rounded border px-3 py-2 text-sm">
          The backup timer is not enabled — no nightly backups will run. Enable it with
          <code className="ml-1">systemctl enable --now droptracker-db-backup.timer</code>.
        </div>
      )}
      {lastRun && !lastRun.success && !running && (
        <div className="bg-osrs-red/10 border-osrs-red/40 text-osrs-red rounded border px-3 py-2 text-sm">
          The last backup run failed ({lastRun.result}
          {lastRun.exit_status != null ? `, exit ${lastRun.exit_status}` : ""}). Check the logs
          below.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Last backup"
          value={<span className={lastStatus.className}>{lastStatus.text}</span>}
          hint={
            lastRun
              ? `${formatRelativeTime(lastRun.started)} · took ${formatDuration(lastRun.duration_seconds)}`
              : undefined
          }
        />
        <StatTile
          label="Next scheduled"
          value={formatUntil(timer.next_run)}
          hint={timer.next_run ? utcDateTime(timer.next_run) : "timer inactive"}
        />
        <StatTile
          label="Local sets"
          value={sets.length}
          hint={`${formatBytes(sets.reduce((sum, s) => sum + s.total_bytes, 0))} · kept ${overview.retention.local_days} days`}
        />
        <StatTile
          label="Disk free"
          value={formatBytes(disk.free_bytes)}
          hint={`of ${formatBytes(disk.total_bytes)} on backup volume`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {confirmRun ? (
          <>
            <button
              onClick={runNow}
              disabled={pending}
              className={`${btn} bg-osrs-gold/20 text-osrs-gold`}
            >
              {busy === "run" ? "…" : "Confirm — run full backup"}
            </button>
            <button
              onClick={() => setConfirmRun(false)}
              disabled={pending}
              className={`${btn} border-osrs-bronze/50 hover:bg-osrs-bronze/30 border`}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmRun(true)}
            disabled={pending || running}
            className={`${btn} bg-osrs-bronze/60 hover:bg-osrs-bronze`}
          >
            {running ? "Backup in progress…" : "Run backup now"}
          </button>
        )}
        <button
          onClick={viewLogs}
          disabled={pending}
          className={`${btn} border-osrs-bronze/50 hover:bg-osrs-bronze/30 border`}
        >
          {busy === "logs" ? "…" : "View logs"}
        </button>
        <button
          onClick={() => router.refresh()}
          disabled={pending}
          className={`${btn} border-osrs-bronze/50 hover:bg-osrs-bronze/30 border`}
        >
          Refresh
        </button>
        {error && <span className="text-osrs-red text-xs">{error}</span>}
        {confirmRun && (
          <span className="text-osrs-parchment-dark/60 text-xs">
            Dumps run with a consistent snapshot (no table locks), but take ~20 minutes.
          </span>
        )}
      </div>

      {logs && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-osrs-gold text-sm font-semibold">
              droptracker-db-backup — recent logs
            </h3>
            <button
              onClick={() => setLogs(null)}
              className="text-osrs-parchment-dark/60 text-xs hover:text-osrs-gold-bright"
            >
              Close
            </button>
          </div>
          <pre className="bg-osrs-brown-dark/80 border-osrs-bronze/30 max-h-72 overflow-auto rounded border p-3 text-xs leading-relaxed">
            {logs.join("\n")}
          </pre>
        </section>
      )}

      <section>
        <h3 className="text-osrs-gold mb-2 text-sm font-semibold">Local backup sets</h3>
        {sets.length === 0 ? (
          <p className="text-osrs-parchment-dark/60 text-sm">
            No backup sets on disk yet. The first set appears after the nightly run (or a manual
            run) completes.
          </p>
        ) : (
          <ul className="divide-osrs-bronze/20 divide-y">
            {sets.map((set) => (
              <li key={set.date} className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium tabular-nums">{set.date}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${SET_STATUS[set.status].className}`}
                  >
                    {SET_STATUS[set.status].label}
                  </span>
                  <span className="text-osrs-parchment-dark/60 text-xs">
                    {formatBytes(set.total_bytes)} · {set.files.length} files
                  </span>
                </div>
                <div className="text-osrs-parchment-dark/50 mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                  {set.files.map((f) => (
                    <span key={f.name} className="tabular-nums">
                      {f.name} <span className="text-osrs-parchment-dark/35">({formatBytes(f.size)})</span>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-osrs-gold mb-2 text-sm font-semibold">Offsite copies (Backblaze B2)</h3>
        {offsite.state === "loading" && (
          <p className="text-osrs-parchment-dark/60 text-sm">Checking the B2 bucket…</p>
        )}
        {offsite.state === "error" && (
          <p className="text-osrs-red text-sm">Offsite check failed: {offsite.error}</p>
        )}
        {offsite.state === "ok" && (
          <>
            <p className="text-osrs-parchment-dark/60 mb-2 text-xs">
              {offsite.data.days.length} day{offsite.data.days.length === 1 ? "" : "s"} ·{" "}
              {formatBytes(offsite.data.total_bytes)} under{" "}
              <code>
                {offsite.data.bucket}/{offsite.data.prefix}
              </code>{" "}
              · kept {overview.retention.remote_days} days
            </p>
            {offsite.data.days.length === 0 ? (
              <p className="text-osrs-red text-sm">
                No offsite copies found — the B2 upload step may be failing. Check the logs.
              </p>
            ) : (
              <ul className="divide-osrs-bronze/20 divide-y">
                {offsite.data.days.map((day) => {
                  const local = sets.find((s) => s.date === day.date);
                  return (
                    <li
                      key={day.date}
                      className="flex flex-wrap items-center gap-3 py-2 text-sm"
                    >
                      <span className="font-medium tabular-nums">{day.date}</span>
                      <span className="text-osrs-parchment-dark/60 text-xs">
                        {day.objects} objects · {formatBytes(day.total_bytes)}
                      </span>
                      {local && local.total_bytes === day.total_bytes && (
                        <span className="text-osrs-green text-xs">matches local set</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
