"use client";

import { useEffect, useState, useTransition } from "react";
import { setEdgeMirror } from "@/app/(site)/(admin)/admin/services/actions";
import type { EdgeMirrorMode, EdgeMirrorState } from "@/lib/api/admin";
import { Alert, Card } from "@/components/ui";

const MODES: { value: EdgeMirrorMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "testers", label: "Bug testers" },
  { value: "all", label: "Everyone" },
];

/** Offered durations for "Everyone". `null` is deliberately last and deliberately unusual. */
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

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Superadmin switch for mirroring live production submissions at the dev
 * instance.
 *
 * The Cloudflare Worker that already fronts POST /webhook sends a second,
 * fire-and-forget copy of the chosen submissions to the dev box — the Bug
 * Testers' only, or everyone's. Production is unaffected either way: the
 * mirror runs in waitUntil and nothing reads its result.
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
    if (state.mode === "off" || expiresAt === null) {
      setNow(null);
      return;
    }
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.mode, expiresAt]);

  // The key lapsing in Redis is what actually stops the mirror; reflect that
  // here rather than leaving a stale mode on screen until someone reloads.
  const lapsed = now !== null && expiresAt !== null && now >= expiresAt;
  const mode: EdgeMirrorMode = lapsed ? "off" : state.mode;
  const testers = state.testers;

  const apply = (next: EdgeMirrorMode) => {
    if (next === mode) return;
    setError(null);
    startTransition(async () => {
      const res = await setEdgeMirror(next, next === "all" ? duration : null);
      if (res.ok) setState(res.state);
      else setError(res.error);
    });
  };

  let status: string;
  if (mode === "off") {
    status = "Off — production only.";
  } else {
    const who = mode === "testers" ? "Mirroring Bug Testers" : "Mirroring everyone";
    const until =
      now !== null && expiresAt !== null
        ? ` — stops in ${formatRemaining(expiresAt - now)}`
        : " — no expiry set";
    status = who + until;
  }

  return (
    <Card padding="p-6" className="mb-6">
      <div className="min-w-0">
        <h2 className="text-osrs-gold text-lg font-semibold">Mirror submissions to dev</h2>
        <p className="text-osrs-parchment-dark/60 mt-1 max-w-3xl text-sm">
          Sends a second copy of live submissions to the dev instance, from the edge Worker that
          already fronts the intake API. Production is not affected — the copy is fire-and-forget
          and its result is never read.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-1" role="radiogroup" aria-label="Who is mirrored to dev">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={mode === m.value}
                disabled={pending}
                onClick={() => apply(m.value)}
                className={`rounded border px-3 py-1.5 text-sm disabled:opacity-50 ${
                  mode === m.value
                    ? "border-osrs-gold bg-osrs-gold/15 text-osrs-gold font-semibold"
                    : "border-osrs-bronze/40 hover:border-osrs-gold"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {mode !== "all" && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-osrs-parchment-dark/70">Everyone runs for</span>
              <select
                id="edge-mirror-duration"
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
        </div>

        <p
          className={`mt-3 text-sm font-medium ${
            mode === "off" ? "text-osrs-parchment-dark/70" : "text-osrs-green"
          }`}
          aria-live="polite"
        >
          {status}
        </p>

        <ul className="text-osrs-parchment-dark/60 mt-2 max-w-3xl list-disc space-y-1 pl-5 text-xs">
          <li>
            <span className="text-osrs-parchment-dark/80 font-medium">Bug testers</span> copies
            every account of anyone holding the Bug Tester badge
            {testers
              ? ` — ${plural(testers.accounts, "account")} across ${plural(testers.users, "tester")} right now`
              : ""}
            . Dev processes their copies like its own traffic: their groups, events, points and
            notifications, all inside the dev guild. Meant to stay on.
          </li>
          <li>
            <span className="text-osrs-parchment-dark/80 font-medium">Everyone</span> copies all
            traffic for a soak test; dev reroutes it to its firehose group. Testers&rsquo; copies
            are still handled as theirs.
          </li>
          <li>Takes effect within ~30s — the Worker polls for this, it is not pushed.</li>
        </ul>
      </div>

      {testers && !testers.key_configured && mode !== "off" && (
        <div className="mt-3">
          <Alert variant="error">
            EDGE_TESTER_KEY isn&rsquo;t set on the backend, so no Bug Tester can be recognised and
            none of their submissions are mirrored.
          </Alert>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
    </Card>
  );
}
