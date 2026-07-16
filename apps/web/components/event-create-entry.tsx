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
}: {
  groupId: number | null;
  initialEvent?: EventDetail | null;
}) {
  const [source, setSource] = useState<"new" | "template">("new");

  if (initialEvent) return <EventSetupWizard groupId={groupId} initialEvent={initialEvent} />;

  const tab = (active: boolean) =>
    `rounded px-3 py-1.5 text-sm font-medium ${
      active
        ? "bg-osrs-bronze text-osrs-parchment"
        : "text-osrs-parchment-dark/70 hover:text-osrs-gold-bright"
    }`;

  return (
    <div className="space-y-4">
      <div className="border-osrs-bronze/25 inline-flex gap-1 rounded-lg border p-1" role="tablist">
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
      {source === "template" ? (
        <EventTemplatePicker groupId={groupId} />
      ) : (
        <EventSetupWizard groupId={groupId} />
      )}
    </div>
  );
}
