"use client";

import { useState, useTransition } from "react";
import { setSeasonalActive } from "@/app/(site)/(admin)/admin/services/actions";
import { Alert, Card } from "@/components/ui";

/**
 * Superadmin kill switch for seasonal-world (Leagues/Deadman) submission
 * processing. When off, every intake path skips seasonal submissions instead
 * of running the seasonal processors — used between seasons so the pipeline
 * does no unnecessary work.
 */
export function SeasonalTogglePanel({ initialActive }: { initialActive: boolean }) {
  const [active, setActive] = useState(initialActive);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onToggle = () => {
    setError(null);
    const next = !active;
    startTransition(async () => {
      const res = await setSeasonalActive(next);
      if (res.ok) {
        setActive(next);
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <Card padding="p-6" className="mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-osrs-gold text-lg font-semibold">Seasonal processing</h2>
          <p className="text-osrs-parchment-dark/60 mt-1 text-sm">
            Global switch for seasonal-world (Leagues / Deadman) submissions. Turn this off
            between seasons — intake will skip seasonal submissions entirely instead of
            running the seasonal processors. Group seasonal settings have no effect while
            this is off.
          </p>
          <p className={`mt-2 text-sm font-medium ${active ? "text-osrs-green" : "text-osrs-parchment-dark/70"}`}>
            {active ? "Active — seasonal submissions are processed." : "Disabled — seasonal submissions are skipped."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={active}
          disabled={pending}
          onClick={onToggle}
          className={`relative mt-1 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            active ? "bg-osrs-gold" : "bg-osrs-stone/50"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 size-5 transform rounded-full bg-white shadow transition-transform ${
              active ? "translate-x-5" : "translate-x-0"
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
