import type { Metadata } from "next";
import { api } from "@/lib/api";
import { ServicePanel } from "@/components/service-panel";
import { SeasonalTogglePanel } from "@/components/admin/seasonal-toggle-panel";
import { EdgeMirrorPanel } from "@/components/admin/edge-mirror-panel";
import { requireDeveloper } from "@/lib/auth";

export const metadata: Metadata = { title: "Services" };

export default async function AdminServicesPage() {
  const user = await requireDeveloper("/admin/services");
  const canControl = user.is_superadmin;
  const [services, seasonal, edgeMirror] = await Promise.all([
    api.adminServices(),
    canControl ? api.adminSeasonal().catch(() => ({ active: true })) : Promise.resolve(null),
    canControl
      ? api
          .adminEdgeMirror()
          .catch(() => ({ enabled: false, sample: 1, expires_at: null }))
      : Promise.resolve(null),
  ]);

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        {canControl ? (
          <>
            Every moving part of DropTracker — APIs, Discord bots, workers, the blue-green web
            pair and shared infrastructure — with live status, uptime and controls. &ldquo;Deploy
            site&rdquo; rebuilds and flips the front-end with zero downtime; stopping a service
            interrupts processing, so those actions ask for confirmation.
          </>
        ) : (
          <>
            Every moving part of DropTracker — APIs, Discord bots, workers, the blue-green web
            pair and shared infrastructure — with live status, uptime, memory and restart
            counts. Service control and journal logs are superadmin-only.
          </>
        )}
      </p>
      {seasonal !== null && <SeasonalTogglePanel initialActive={seasonal.active} />}
      {edgeMirror !== null && <EdgeMirrorPanel initial={edgeMirror} />}
      <ServicePanel services={services} canControl={canControl} />
    </div>
  );
}
