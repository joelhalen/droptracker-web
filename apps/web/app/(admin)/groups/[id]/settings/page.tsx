import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { ConfigEditor } from "@/components/config-editor";

export const metadata: Metadata = { title: "Group settings" };

type Params = Promise<{ id: string }>;

// Access is gated by the (admin)/groups/[id] layout.
export default async function GroupSettingsPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  const config = await api.groupConfig(groupId);

  return (
    <div className="max-w-2xl">
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Notification, lootboard, points, and integration configuration.
      </p>
      <ConfigEditor groupId={groupId} initial={config} />
    </div>
  );
}
