import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { requireGroupAdminPage } from "@/lib/auth";
import { AuthorizedUsersManager } from "@/components/authorized-users-manager";

type Params = Promise<{ id: string }>;

export const metadata = { title: "Authorized users" };

export default async function AuthorizedUsersPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  // web64a: the shared layout now admits event managers, so this admin-only
  // page must re-assert full group admin (and gives us the viewer identity).
  const user = await requireGroupAdminPage(groupId);
  const initial = await api.groupAuthorizedUsers(groupId);

  return (
    <div className="space-y-4">
      <p className="text-osrs-parchment-dark/80 max-w-2xl text-sm">
        Authorized users can manage this group — its settings, notifications, members, and the
        Discord bot&apos;s admin commands — without needing Discord server permissions. Add a
        trusted co-admin here, or remove one who has stepped down.
      </p>
      <AuthorizedUsersManager groupId={groupId} initial={initial} viewerUserId={user.user_id} />
    </div>
  );
}
