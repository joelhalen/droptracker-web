"use client";

/**
 * Superadmin services dashboard: every moving part of the app (APIs, Discord
 * bots, workers, blue-green web pair + deploy trigger, read-only infra),
 * grouped by tier with live-polled status, uptime/memory/restart stats, and
 * per-unit controls.
 *
 * Action policy comes from the backend registry (`ServiceStatus.actions` +
 * `confirm_*` flags — see web_api/routes/admin.py SERVICE_REGISTRY), so this
 * component renders capabilities rather than hardcoding unit names. The one
 * unit-kind it special-cases is `deploy`: droptracker-node is the blue-green
 * deploy oneshot, where "restart" queues a ~2-minute zero-downtime deploy.
 *
 * Logs open in a modal with line-count, filter, auto-follow and download —
 * replacing the old shared <pre> pinned under the whole list.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ServiceStatus } from "@droptracker/api-types";
import {
  fetchServiceLogs,
  refreshServices,
  runServiceAction,
} from "@/app/(site)/(admin)/admin/services/actions";
import { Card } from "@/components/ui";

/* --- tiny presentation helpers --------------------------------------------- */

const STATUS_META: Record<ServiceStatus["status"], { label: string; dot: string; text: string }> = {
  running: { label: "Running", dot: "bg-osrs-green", text: "text-osrs-green" },
  stopped: { label: "Stopped", dot: "bg-osrs-parchment-dark/40", text: "text-osrs-parchment-dark/60" },
  failed: { label: "Failed", dot: "bg-osrs-red", text: "text-osrs-red" },
  starting: { label: "Starting", dot: "bg-osrs-gold", text: "text-osrs-gold" },
  stopping: { label: "Stopping", dot: "bg-osrs-gold", text: "text-osrs-gold" },
  unknown: { label: "Unknown", dot: "bg-osrs-parchment-dark/40", text: "text-osrs-parchment-dark/60" },
};

function formatUptime(since: number | null): string | null {
  if (!since) return null;
  let s = Math.max(0, Math.floor(Date.now() / 1000) - since);
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s - h * 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Deploy trigger reads better with deploy-specific wording. */
function statusLabel(s: ServiceStatus): string {
  if (s.kind === "deploy") {
    if (s.status === "starting") return "Deploying…";
    if (s.status === "running") return s.last_result === "success" ? "Idle — last deploy OK" : "Idle";
    if (s.status === "failed") return "Last deploy FAILED";
  }
  return STATUS_META[s.status].label;
}

const btn = "rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50";

/* --- main panel ------------------------------------------------------------- */

export function ServicePanel({ services: initial }: { services: ServiceStatus[] }) {
  const [services, setServices] = useState(initial);
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null); // "unit:action"
  const [error, setError] = useState<{ unit: string; message: string } | null>(null);
  const [logsUnit, setLogsUnit] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const poll = useCallback(async () => {
    try {
      const next = await refreshServices();
      setServices(next);
      setUpdatedAt(Date.now());
    } catch {
      /* transient poll failure — keep showing the last snapshot */
    }
  }, []);

  // Live status polling: fast while something is transitioning (a deploy sits
  // in "starting" for ~2 min), relaxed otherwise.
  const transitioning = services.some((s) => s.status === "starting" || s.status === "stopping");
  useEffect(() => {
    const id = setInterval(poll, transitioning ? 3000 : 12000);
    return () => clearInterval(id);
  }, [poll, transitioning]);

  const act = (unit: string, action: "start" | "stop" | "restart", confirm = false) => {
    setError(null);
    setConfirming(null);
    setBusy(`${unit}:${action}`);
    startTransition(async () => {
      const result = await runServiceAction(unit, action, confirm);
      if (!result.ok) setError({ unit, message: result.error });
      await poll();
      setBusy(null);
    });
  };

  const groups = useMemo(() => {
    const out = new Map<string, ServiceStatus[]>();
    for (const s of services) {
      const list = out.get(s.category) ?? [];
      list.push(s);
      out.set(s.category, list);
    }
    return [...out.entries()];
  }, [services]);

  const running = services.filter((s) => s.status === "running").length;
  const failed = services.filter((s) => s.status === "failed");
  const logsService = logsUnit ? services.find((s) => s.unit === logsUnit) : undefined;

  return (
    <div className="space-y-6">
      {/* Fleet summary */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="text-osrs-parchment">
          <span className={failed.length ? "text-osrs-red font-semibold" : "text-osrs-green font-semibold"}>
            {running}/{services.length}
          </span>{" "}
          services running
        </span>
        {failed.length > 0 && (
          <span className="text-osrs-red">
            ⚠ {failed.map((s) => s.name).join(", ")} {failed.length === 1 ? "has" : "have"} failed
          </span>
        )}
        {transitioning && <span className="text-osrs-gold animate-pulse">changes in progress…</span>}
        <span className="text-osrs-parchment-dark/50 ml-auto text-xs">
          updated {Math.max(0, Math.round((Date.now() - updatedAt) / 1000))}s ago ·{" "}
          <button type="button" onClick={() => void poll()} className="hover:text-osrs-gold-bright underline">
            refresh
          </button>
        </span>
      </div>

      {groups.map(([category, list]) => (
        <section key={category}>
          <h2 className="text-osrs-gold mb-2 text-sm font-semibold uppercase tracking-wide">
            {category}
          </h2>
          <Card padding="p-0">
            <ul className="divide-osrs-bronze/15 divide-y">
              {list.map((s) => (
                <ServiceRow
                  key={s.unit}
                  s={s}
                  busy={busy}
                  confirming={confirming}
                  error={error?.unit === s.unit ? error.message : null}
                  onAct={act}
                  onConfirm={setConfirming}
                  onLogs={() => setLogsUnit(s.unit)}
                />
              ))}
            </ul>
          </Card>
        </section>
      ))}

      {logsService && <LogsModal service={logsService} onClose={() => setLogsUnit(null)} />}
    </div>
  );
}

/* --- one service row --------------------------------------------------------- */

function ServiceRow({
  s,
  busy,
  confirming,
  error,
  onAct,
  onConfirm,
  onLogs,
}: {
  s: ServiceStatus;
  busy: string | null;
  confirming: string | null;
  error: string | null;
  onAct: (unit: string, action: "start" | "stop" | "restart", confirm?: boolean) => void;
  onConfirm: (key: string | null) => void;
  onLogs: () => void;
}) {
  const meta = STATUS_META[s.status];
  const uptime = formatUptime(s.since);
  const anyBusy = busy !== null;
  const isDeploying = s.kind === "deploy" && s.status === "starting";

  const can = (a: "start" | "stop" | "restart") => s.actions.includes(a);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      {/* Status dot */}
      <span className="relative mt-0.5 flex size-2.5 shrink-0">
        {(s.status === "running" || s.status === "starting" || s.status === "stopping") && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${meta.dot}`}
          />
        )}
        <span className={`relative inline-flex size-2.5 rounded-full ${meta.dot}`} />
      </span>

      {/* Identity */}
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-osrs-parchment font-medium">{s.name}</span>
          <span className="text-osrs-parchment-dark/40 font-mono text-xs">
            {s.unit}
            {s.port ? `:${s.port}` : ""}
          </span>
        </div>
        {s.description && (
          <div className="text-osrs-parchment-dark/55 text-xs">{s.description}</div>
        )}
        {error && <div className="text-osrs-red mt-1 text-xs">{error}</div>}
      </div>

      {/* Vitals */}
      <div className="text-osrs-parchment-dark/60 flex shrink-0 items-center gap-3 text-xs tabular-nums">
        <span className={`font-medium ${meta.text}`}>{statusLabel(s)}</span>
        {uptime && s.active && <span title="Uptime">{uptime}</span>}
        {typeof s.memory_mb === "number" && (
          <span title="Memory (RSS)">{s.memory_mb >= 1024 ? `${(s.memory_mb / 1024).toFixed(1)} GB` : `${Math.round(s.memory_mb)} MB`}</span>
        )}
        {s.n_restarts > 0 && (
          <span
            className="bg-osrs-gold/15 text-osrs-gold-bright rounded px-1.5 py-0.5"
            title="Automatic restarts since boot (Restart=on-failure)"
          >
            ↻ {s.n_restarts}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        {s.kind === "deploy" ? (
          <button
            type="button"
            onClick={() => onAct(s.unit, "restart")}
            disabled={anyBusy || isDeploying}
            className={`${btn} bg-osrs-gold/90 text-osrs-brown-dark hover:bg-osrs-gold`}
            title="Builds the idle colour, health-checks it, then flips nginx — the site never goes offline."
          >
            {isDeploying ? "Deploying…" : busy === `${s.unit}:restart` ? "…" : "Deploy site"}
          </button>
        ) : (
          <>
            {can("restart") &&
              (confirming === `${s.unit}:restart` ? (
                <ConfirmPair
                  label="Confirm restart"
                  onYes={() => onAct(s.unit, "restart", true)}
                  onNo={() => onConfirm(null)}
                  disabled={anyBusy}
                />
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    s.confirm_restart ? onConfirm(`${s.unit}:restart`) : onAct(s.unit, "restart")
                  }
                  disabled={anyBusy}
                  className={`${btn} bg-osrs-bronze/60 hover:bg-osrs-bronze`}
                >
                  {busy === `${s.unit}:restart` ? "…" : "Restart"}
                </button>
              ))}
            {s.active && can("stop") &&
              (confirming === `${s.unit}:stop` ? (
                <ConfirmPair
                  label="Confirm stop"
                  onYes={() => onAct(s.unit, "stop", true)}
                  onNo={() => onConfirm(null)}
                  disabled={anyBusy}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onConfirm(`${s.unit}:stop`)}
                  disabled={anyBusy}
                  className={`${btn} bg-osrs-red/20 text-osrs-red hover:bg-osrs-red/30`}
                >
                  {busy === `${s.unit}:stop` ? "…" : "Stop"}
                </button>
              ))}
            {!s.active && can("start") && (
              <button
                type="button"
                onClick={() => onAct(s.unit, "start")}
                disabled={anyBusy}
                className={`${btn} bg-osrs-green/20 text-osrs-green hover:bg-osrs-green/30`}
              >
                {busy === `${s.unit}:start` ? "…" : "Start"}
              </button>
            )}
          </>
        )}
        <button
          type="button"
          onClick={onLogs}
          disabled={anyBusy}
          className={`${btn} border-osrs-bronze/50 hover:bg-osrs-bronze/30 border`}
        >
          Logs
        </button>
      </div>
    </li>
  );
}

function ConfirmPair({
  label,
  onYes,
  onNo,
  disabled,
}: {
  label: string;
  onYes: () => void;
  onNo: () => void;
  disabled: boolean;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onYes}
        disabled={disabled}
        className={`${btn} bg-osrs-red text-osrs-parchment hover:bg-osrs-red/80`}
      >
        {label}
      </button>
      <button
        type="button"
        onClick={onNo}
        disabled={disabled}
        className={`${btn} border-osrs-bronze/50 hover:bg-osrs-bronze/30 border`}
      >
        Cancel
      </button>
    </>
  );
}

/* --- logs modal --------------------------------------------------------------- */

const LINE_OPTIONS = [100, 200, 500] as const;

function LogsModal({ service, onClose }: { service: ServiceStatus; onClose: () => void }) {
  const [lines, setLines] = useState<string[] | null>(null);
  const [lineCount, setLineCount] = useState<number>(200);
  const [filter, setFilter] = useState("");
  const [follow, setFollow] = useState(false);
  const [loading, setLoading] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  const load = useCallback(
    async (n: number) => {
      setLoading(true);
      try {
        const result = await fetchServiceLogs(service.unit, n);
        setLines(result.lines);
      } finally {
        setLoading(false);
      }
    },
    [service.unit],
  );

  // Initial load + reload when the line count changes.
  useEffect(() => {
    void load(lineCount);
  }, [load, lineCount]);

  // Follow mode: re-fetch every 3s (journalctl tail — good enough to watch a
  // deploy or a restart settle without holding a stream open).
  useEffect(() => {
    if (!follow) return;
    const id = setInterval(() => void load(lineCount), 3000);
    return () => clearInterval(id);
  }, [follow, load, lineCount]);

  // Pin to the bottom whenever new lines land.
  useEffect(() => {
    const el = preRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const visible = useMemo(() => {
    if (!lines) return null;
    if (!filter.trim()) return lines;
    const q = filter.toLowerCase();
    return lines.filter((ln) => ln.toLowerCase().includes(q));
  }, [lines, filter]);

  const download = () => {
    if (!lines) return;
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${service.unit}-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lineClass = (ln: string) => {
    const l = ln.toLowerCase();
    if (l.includes("error") || l.includes("critical") || l.includes("traceback") || l.includes("failed"))
      return "text-osrs-red";
    if (l.includes("warn")) return "text-osrs-gold";
    return "";
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${service.name} logs`}
    >
      <div
        className="bg-osrs-brown-dark border-osrs-bronze/40 flex max-h-[85vh] w-full max-w-4xl flex-col rounded-lg border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + controls */}
        <div className="border-osrs-bronze/25 flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3">
          <h3 className="text-osrs-gold text-sm font-semibold">
            {service.name}
            <span className="text-osrs-parchment-dark/40 ml-2 font-mono text-xs font-normal">{service.unit}</span>
          </h3>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter lines…"
              className="bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 w-36 rounded border px-2 py-1 focus:outline-none"
            />
            <select
              value={lineCount}
              onChange={(e) => setLineCount(Number(e.target.value))}
              className="bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment rounded border px-2 py-1"
            >
              {LINE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} lines
                </option>
              ))}
            </select>
            <label className="text-osrs-parchment-dark/70 flex items-center gap-1.5">
              <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
              Follow
            </label>
            <button
              type="button"
              onClick={() => void load(lineCount)}
              disabled={loading}
              className={`${btn} bg-osrs-bronze/60 hover:bg-osrs-bronze`}
            >
              {loading ? "…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={download}
              disabled={!lines}
              className={`${btn} border-osrs-bronze/50 hover:bg-osrs-bronze/30 border`}
            >
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`${btn} border-osrs-bronze/50 hover:bg-osrs-bronze/30 border`}
            >
              Close
            </button>
          </div>
        </div>

        {/* Log body */}
        <pre
          ref={preRef}
          className="min-h-48 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed"
        >
          {visible === null ? (
            <span className="text-osrs-parchment-dark/50">Loading logs…</span>
          ) : visible.length === 0 ? (
            <span className="text-osrs-parchment-dark/50">
              {filter ? "No lines match the filter." : "No log output."}
            </span>
          ) : (
            visible.map((ln, i) => (
              <div key={i} className={lineClass(ln)}>
                {ln}
              </div>
            ))
          )}
        </pre>
        {filter && lines && visible && (
          <div className="border-osrs-bronze/25 text-osrs-parchment-dark/50 border-t px-4 py-1.5 text-xs">
            {visible.length} of {lines.length} lines match
          </div>
        )}
      </div>
    </div>
  );
}
