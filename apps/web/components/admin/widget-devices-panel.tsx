"use client";

import { useState, useTransition } from "react";
import { Alert, Button, EmptyState } from "@/components/ui";
import type { PairedWidgetDevice, WidgetDevice } from "@/lib/api/admin-widget";
import { pairWidgetDevice, revokeWidgetDevice } from "@/app/(site)/(admin)/admin/widget/actions";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";

function when(ts: number | null): string {
  return ts ? new Date(ts * 1000).toLocaleString() : "never";
}

export function WidgetDevicesPanel({ initialDevices }: { initialDevices: WidgetDevice[] }) {
  const [devices, setDevices] = useState(initialDevices);
  const [label, setLabel] = useState("");
  const [paired, setPaired] = useState<PairedWidgetDevice | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onPair = () =>
    startTransition(async () => {
      setError(null);
      try {
        const created = await pairWidgetDevice(label || "Phone");
        setPaired(created);
        setCopied(false);
        setLabel("");
        const { token: _token, pair_url: _url, ...device } = created;
        setDevices((d) => [device, ...d]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Pairing failed.");
      }
    });

  const onRevoke = (id: number) =>
    startTransition(async () => {
      setError(null);
      try {
        const revoked = await revokeWidgetDevice(id);
        setDevices((d) => d.map((x) => (x.id === id ? revoked : x)));
        if (paired?.id === id) setPaired(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Revoke failed.");
      }
    });

  const onCopy = async () => {
    if (!paired) return;
    await navigator.clipboard.writeText(paired.token);
    setCopied(true);
  };

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      <section className="border-osrs-bronze/30 space-y-3 rounded border p-4">
        <h2 className="text-osrs-gold-bright font-semibold">Pair a device</h2>
        <p className="text-osrs-parchment-dark/70 text-sm">
          Open this page on the phone that has the widget app installed, pair it, then tap{" "}
          <strong>Open in the widget app</strong>. On another device, copy the token and paste it
          into the app instead.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className={field}
            placeholder="Label, e.g. S25 Ultra"
            maxLength={64}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button variant="secondary" onClick={onPair} loading={pending} loadingLabel="Pairing…">
            Pair device
          </Button>
        </div>

        {paired && (
          <div className="border-osrs-gold/40 bg-osrs-brown-dark/40 space-y-3 rounded border p-3">
            <Alert variant="info">
              This token is shown once. Anyone holding it can read the admin summary until you
              revoke it.
            </Alert>
            <code className="block break-all text-xs">{paired.token}</code>
            <div className="flex flex-wrap gap-2">
              <a
                className="bg-osrs-gold text-osrs-brown-dark rounded px-3 py-2 text-sm font-semibold"
                href={paired.pair_url}
              >
                Open in the widget app
              </a>
              <Button variant="ghost" size="sm" onClick={onCopy}>
                {copied ? "Copied" : "Copy token"}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-osrs-gold-bright font-semibold">Devices</h2>
        {devices.length === 0 ? (
          <EmptyState title="No devices paired" />
        ) : (
          <ul className="divide-osrs-bronze/20 divide-y">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className={d.revoked_at ? "text-osrs-parchment-dark/40 line-through" : ""}>
                    {d.label} <code className="text-xs opacity-60">{d.token_hint}…</code>
                  </div>
                  <div className="text-osrs-parchment-dark/50 text-xs">
                    Paired {when(d.created_at)} · last used {when(d.last_used_at)}
                    {d.revoked_at ? ` · revoked ${when(d.revoked_at)}` : ""}
                  </div>
                </div>
                {!d.revoked_at && (
                  <Button variant="danger" size="sm" onClick={() => onRevoke(d.id)} disabled={pending}>
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
