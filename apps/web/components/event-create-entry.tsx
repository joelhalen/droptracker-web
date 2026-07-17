"use client";

/**
 * Entry point for creating an event: the guided setup wizard, or re-running
 * a saved template. When resuming an existing draft (?event={id}) the tabs
 * disappear — you're already mid-wizard.
 */
import { useState } from "react";
import type { EventDetail } from "@droptracker/api-types";
import { EventSetupWizard } from "@/components/event-setup-wizard";
import { EventTemplatePicker } from "@/components/event-template-picker";

export function EventCreateEntry({
  groupId,
  initialEvent = null,
  initialStep = 0,
}: {
  groupId: number | null;
  initialEvent?: EventDetail | null;
  /** Wizard step to open on (?step={n}) — see EventSetupWizard. */
  initialStep?: number;
}) {
  const [source, setSource] = useState<"new" | "template">("new");

  // Resuming an existing draft (?event={id}): hide the tabs — you're already
  // mid-wizard. The wizard MUST stay at the same tree position whether or not
  // `initialEvent` is set: when the wizard itself sets ?event mid-flow
  // (window.history.replaceState — which the App Router now treats as the live
  // URL — followed by a server action's revalidatePath re-rendering this page),
  // `initialEvent` flips null → draft. Keeping the wizard in one slot lets React
  // reconcile the running instance instead of remounting it. An earlier
  // `if (initialEvent) return …` swapped subtrees here, remounting the wizard —
  // which snapped the user back to step 1 and dropped the draft reference,
  // risking a duplicate event on the next "create draft". See event-setup-wizard.tsx.
  const resuming = initialEvent != null;

  const tab = (active: boolean) =>
    `rounded px-3 py-1.5 text-sm font-medium ${
      active
        ? "bg-osrs-bronze text-osrs-parchment"
        : "text-osrs-parchment-dark/70 hover:text-osrs-gold-bright"
    }`;

  return (
    <div className="space-y-4">
      {!resuming && (
        <div
          className="border-osrs-bronze/25 inline-flex gap-1 rounded-lg border p-1"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={source === "new"}
            onClick={() => setSource("new")}
            className={tab(source === "new")}
          >
            Guided setup
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={source === "template"}
            onClick={() => setSource("template")}
            className={tab(source === "template")}
          >
            Start from a template
          </button>
        </div>
      )}
      {!resuming && source === "template" ? (
        <EventTemplatePicker groupId={groupId} />
      ) : (
        <EventSetupWizard groupId={groupId} initialEvent={initialEvent} initialStep={initialStep} />
      )}
    </div>
  );
}
