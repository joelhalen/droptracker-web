import type { Metadata } from "next";
import { api } from "@/lib/api";
import { WidgetDevicesPanel } from "@/components/admin/widget-devices-panel";
import { requireSuperadmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Phone widget" };
export const dynamic = "force-dynamic";

export default async function AdminWidgetPage() {
  await requireSuperadmin("/admin/widget");
  const devices = await api.adminWidgetDevices();

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Pair the DropTracker Android widget to see tickets, your inbox, revenue and today&apos;s
        growth on your home screen. A device token can only read that one summary. It cannot sign
        in or change anything, and it stops working the moment you revoke it here.
      </p>
      <WidgetDevicesPanel initialDevices={devices} />
    </div>
  );
}
