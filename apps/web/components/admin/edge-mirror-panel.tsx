"use client";

import { useEffect, useState, useTransition } from "react";
import { setEdgeMirror } from "@/app/(site)/(admin)/admin/services/actions";
import type { EdgeMirrorState } from "@/lib/api/admin";
import { Alert, Card } from "@/components/ui";

/** Offered durations. `null` is deliberately last and deliberately unusual. */
const DURATIONS: { label: string; value: number | null }[] = [
  { label: "1 hour", value: 3600 },
  { label: "4 hours", value: 4 * 3600 },
  { label: "24 hours", value: 24 * 3600 },
  { label: "Until I turn it off", value: null },
];

/** Shortest option, so a mis-click costs an hour rather than a weekend. */
const DEFAULT_DURATION: number | null = 3600;

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Superadmin switch for mirroring live production submissions at the dev
 * instance.
 *
 * The Cloudflare Worker that already fronts POST /webhook starts sending a
 * second, fire-and-forget copy of each submission to the dev box. Production is
 * unaffected either way: the mirror runs in waitUntil and nothing reads its
 * result.
 */
export function EdgeMirrorPanel({ initial }: { initial: EdgeMirrorState }) {
  const [state, setState] = useState<EdgeMirrorState>(initial);
  const [duration, setDuration] = useState<number | null>(DEFAULT_DURATION);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Only set after mount, so the countdown cannot cause a hydration mismatch.
  const [now, setNow] = useState<number | null>(null);
  const expiresAt = state.expires_at ? Date.parse(state.expires_at) : null;

  useEffect(() => {
    if (!state.enabled || expiresAt === null) {
      setNow(null);
      return;
    }
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.enabled, expiresAt]);

  // The key lapsing in Redis is what actually stops the mirror; reflect that
  // here rather than leaving a stale "on" on screen until someone reloads.
  const lapsed = now !== null && expiresAt !== null && now >= expiresAt;
  const on = state.enabled && !lapsed;

  const apply = (enabled: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await setEdgeMirror(enabled, enabled ? duration : null);
      if (res.ok) setState(res.state);
      else setError(res.error);
    });
  };

  return (
    <Card padding="p-6" className="mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-osrs-gold text-lg font-semibold">Mirror submissions to dev</h2>
          <p className="text-osrs-parchment-dark/60 mt-1 text-sm">
            Sends a second copy of every live submission to the dev instance, from the edge
            Worker that already fronts the intake API. Production is not affected — the copy is
            fire-and-forget and its result is never read. On dev, mirrored submissions are
            rerouted to the dev sink group, so no real group&rsquo;s Discord is touched.
          </p>
          <p
            className={`mt-2 text-sm font-medium ${
              on ? "text-osrs-green" : "text-osrs-parchment-dark/70"
            }`}
          >
            {on ? (
              <>
                Mirroring to dev
                {now !== null && expiresAt !== null
                  ? ` — stops in ${formatRemaining(expiresAt - now)}`
                  : " — no expiry set"}
              </>
            ) : (
              "Off — production only."
            )}
          </p>
          {!on && (
            <label className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-osrs-parchment-dark/70">Run for</span>
              <select
                value={duration === null ? "none" : String(duration)}
                disabled={pending}
                onChange={(e) =>
                  setDuration(e.target.value === "none" ? null : Number(e.target.value))
                }
                className="bg-osrs-stone/40 text-osrs-parchment border-osrs-stone/60 rounded border px-2 py-1 text-sm disabled:opacity-50"
              >
                {DURATIONS.map((d) => (
                  <option key={d.label} value={d.value === null ? "none" : String(d.value)}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="text-osrs-parchment-dark/50 mt-2 text-xs">
            Takes effect within ~60s — the Worker polls for this, it is not pushed.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Mirror submissions to dev"
          disabled={pending}
          onClick={() => apply(!on)}
          className={`relative mt-1 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            on ? "bg-osrs-gold" : "bg-osrs-stone/50"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 size-5 transform rounded-full bg-white shadow transition-transform ${
              on ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      {error && (
        <div className="mt-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
    </Card>
  );
}
