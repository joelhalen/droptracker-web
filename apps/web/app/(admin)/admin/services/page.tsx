import type { Metadata } from "next";
import { api } from "@/lib/api";
import { ServicePanel } from "@/components/service-panel";
import { SeasonalTogglePanel } from "@/components/admin/seasonal-toggle-panel";

export const metadata: Metadata = { title: "Services" };

export default async function AdminServicesPage() {
  const [services, seasonal] = await Promise.all([
    api.adminServices(),
    api.adminSeasonal().catch(() => ({ active: true })),
  ]);

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Every moving part of DropTracker — APIs, Discord bots, workers, the blue-green web pair
        and shared infrastructure — with live status, uptime and controls. &ldquo;Deploy
        site&rdquo; rebuilds and flips the front-end with zero downtime; stopping a service
        interrupts processing, so those actions ask for confirmation.
      </p>
      <SeasonalTogglePanel initialActive={seasonal.active} />
      <ServicePanel services={services} />
    </div>
  );
}
