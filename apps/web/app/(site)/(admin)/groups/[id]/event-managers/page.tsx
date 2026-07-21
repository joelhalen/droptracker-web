import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { requireGroupAdminPage } from "@/lib/auth";
import { EventManagersManager } from "@/components/event-managers-manager";

type Params = Promise<{ id: string }>;

export const metadata = { title: "Event managers" };

export default async function EventManagersPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  // Only full group admins may appoint event managers (web64a).
  await requireGroupAdminPage(groupId);
  const initial = await api.groupEventManagers(groupId);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-osrs-gold text-lg font-semibold">Event managers</h2>
        <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
          Give a trusted member full control of this group&apos;s <strong>events</strong> —
          creating, editing, deleting, and configuring them (including Discord settings) —
          <strong> without</strong> any other admin access to the group. They will not be
          able to change group settings, members, the subscription, or appoint other
          managers. Group owners and admins already manage events, so they don&apos;t need
          to be added here.
        </p>
      </div>
      <EventManagersManager groupId={groupId} initial={initial} />
    </div>
  );
}
