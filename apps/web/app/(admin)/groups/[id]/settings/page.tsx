import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { api } from "@/lib/api";
import { requireUser, canAdminGroup } from "@/lib/auth";
import { ConfigEditor } from "@/components/config-editor";

export const metadata: Metadata = { title: "Group settings" };

type Params = Promise<{ id: string }>;

export default async function GroupSettingsPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  const user = await requireUser(`/groups/${groupId}/settings`);
  if (!canAdminGroup(user, groupId)) {
    redirect(`/groups/${groupId}`);
  }

  const [group, config] = await Promise.all([api.group(groupId), api.groupConfig(groupId)]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/groups/${groupId}`}
          className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
        >
          ← {group.name}
        </Link>
        <h1 className="text-osrs-gold mt-1 text-2xl font-bold">Group settings</h1>
        <p className="text-osrs-parchment-dark/70 text-sm">
          Notification, lootboard, points, and integration configuration.
        </p>
      </div>
      <ConfigEditor groupId={groupId} initial={config} />
    </div>
  );
}
