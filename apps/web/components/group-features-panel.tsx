"use client";

/**
 * "Features you haven't tried" on the group admin Overview. The same catalog
 * as the setup wizard's "Turn things on" step and the Discord /group-setup
 * panel (disc/db/group_features.py). Toggle features switch on in place;
 * everything else links to the page that sets it up.
 */
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import type { GroupFeatures } from "@droptracker/api-types";
import { enableWizardFeature } from "@/app/(site)/(admin)/groups/new/actions";
import { Card } from "@/components/ui";
import { getErrorMessage, unwrapActionResult } from "@/lib/errors";

const linkBtn =
  "border-osrs-bronze/50 hover:bg-osrs-bronze/30 shrink-0 rounded border px-2.5 py-1 text-xs font-medium";

export function GroupFeaturesPanel({ groupId, data }: { groupId: number; data: GroupFeatures }) {
  const [features, setFeatures] = useState(data.features);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const off = features.filter((f) => f.status === "off");
  const locked = features.filter((f) => f.status === "locked");
  const on = features.length - off.length - locked.length;
  if (off.length === 0 && locked.length === 0) return null;

  async function turnOn(key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = unwrapActionResult(await enableWizardFeature(groupId, key)).data;
      setFeatures((prev) => prev.map((f) => (f.key === key ? (res.feature ?? { ...f, status: "on" }) : f)));
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't switch that on."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-osrs-gold text-lg font-semibold">Features you haven&apos;t tried</h2>
        <span className="text-osrs-parchment-dark/70 text-sm">
          {on} of {features.length} in use
        </span>
      </div>
      {error && <p className="text-osrs-red mb-2 text-sm">{error}</p>}
      <ul className="divide-osrs-bronze/20 divide-y">
        {off.map((f) => (
          <li key={f.key} className="flex flex-wrap items-start gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{f.title}</div>
              <div className="text-osrs-parchment-dark/70 text-xs">{f.blurb}</div>
            </div>
            {f.kind === "toggle" ? (
              <button type="button" className={linkBtn} disabled={busy != null} onClick={() => turnOn(f.key)}>
                {busy === f.key ? "Turning on…" : "Turn on"}
              </button>
            ) : (
              <Link href={f.path as Route} className={linkBtn}>
                Set up
              </Link>
            )}
          </li>
        ))}
      </ul>
      {locked.length > 0 && (
        <p className="text-osrs-parchment-dark/60 mt-3 text-xs">
          With a plan: {locked.map((f) => `${f.title}${f.tier ? ` (${f.tier})` : ""}`).join(", ")}.{" "}
          <Link href="/premium" className="text-osrs-gold-bright underline">
            Compare plans
          </Link>
        </p>
      )}
    </Card>
  );
}
