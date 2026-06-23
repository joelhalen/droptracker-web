"use client";

import { useState, useTransition } from "react";
import type { ServiceStatus } from "@droptracker/api-types";
import { fetchServiceLogs, runServiceAction } from "@/app/(admin)/admin/services/actions";

const STATUS_STYLES: Record<ServiceStatus["status"], string> = {
  running: "text-osrs-green",
  stopped: "text-osrs-parchment-dark/60",
  failed: "text-osrs-red",
  unknown: "text-osrs-parchment-dark/60",
};

export function ServicePanel({ services }: { services: ServiceStatus[] }) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ unit: string; lines: string[] } | null>(null);

  const act = (unit: string, action: "start" | "stop" | "restart") => {
    setBusy(`${unit}:${action}`);
    startTransition(async () => {
      await runServiceAction(unit, action);
      setBusy(null);
    });
  };

  const viewLogs = (unit: string) => {
    setBusy(`${unit}:logs`);
    startTransition(async () => {
      const result = await fetchServiceLogs(unit);
      setLogs(result);
      setBusy(null);
    });
  };

  const btn = "rounded px-2.5 py-1 text-xs disabled:opacity-50";

  return (
    <div className="space-y-6">
      <ul className="divide-osrs-bronze/20 divide-y">
        {services.map((s) => (
          <li key={s.unit} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-osrs-parchment-dark/50 text-xs">{s.unit}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm capitalize ${STATUS_STYLES[s.status]}`}>● {s.status}</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => act(s.unit, "restart")}
                  disabled={pending}
                  className={`${btn} bg-osrs-bronze/60 hover:bg-osrs-bronze`}
                >
                  {busy === `${s.unit}:restart` ? "…" : "Restart"}
                </button>
                <button
                  onClick={() => act(s.unit, s.active ? "stop" : "start")}
                  disabled={pending}
                  className={`${btn} ${
                    s.active ? "bg-osrs-red/20 text-osrs-red" : "bg-osrs-green/20 text-osrs-green"
                  }`}
                >
                  {busy === `${s.unit}:stop` || busy === `${s.unit}:start`
                    ? "…"
                    : s.active
                      ? "Stop"
                      : "Start"}
                </button>
                <button
                  onClick={() => viewLogs(s.unit)}
                  disabled={pending}
                  className={`${btn} border-osrs-bronze/50 hover:bg-osrs-bronze/30 border`}
                >
                  Logs
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {logs && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-osrs-gold text-sm font-semibold">{logs.unit} — recent logs</h3>
            <button
              onClick={() => setLogs(null)}
              className="text-osrs-parchment-dark/60 text-xs hover:text-osrs-gold-bright"
            >
              Close
            </button>
          </div>
          <pre className="bg-osrs-brown-dark/80 border-osrs-bronze/30 max-h-72 overflow-auto rounded border p-3 text-xs leading-relaxed">
            {logs.lines.join("\n")}
          </pre>
        </section>
      )}
    </div>
  );
}
