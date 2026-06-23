import type { Metadata } from "next";
import { api } from "@/lib/api";
import { ServicePanel } from "@/components/service-panel";

export const metadata: Metadata = { title: "Services" };

export default async function AdminServicesPage() {
  const services = await api.adminServices();

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Control the backend services and inspect recent logs. Stopping a service interrupts
        processing — proceed with care.
      </p>
      <ServicePanel services={services} />
    </div>
  );
}
