import type { Metadata } from "next";
import { api } from "@/lib/api";
import { EventTypesManager } from "@/components/admin/event-types-manager";

export const metadata: Metadata = { title: "Event types" };

export default async function AdminEventTypesPage() {
  const types = await api.adminEventTypes();

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Site-wide availability of each event format. Disabling a type (or marking it
        staff-only) blocks <em>creating</em> new events of that type for everyone except
        superadmins and the groups on its test allowlist — events that already exist keep
        running, and the gate re-opens the moment the switch flips back.
      </p>
      <EventTypesManager initial={types} />
    </div>
  );
}
