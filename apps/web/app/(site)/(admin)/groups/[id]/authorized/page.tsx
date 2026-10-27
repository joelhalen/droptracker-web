import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { requireGroupAdminPage } from "@/lib/auth";
import { AuthorizedUsersManager } from "@/components/authorized-users-manager";
import { GroupDataRemovalPanel } from "@/components/data-removal";
import { RankRolesPanel } from "@/components/rank-roles-card";
import { SettingsSectionShell } from "@/components/settings-section";

type Params = Promise<{ id: string }>;

export const metadata = { title: "Roles & access" };

export default async function AuthorizedUsersPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  // web64a: the shared layout now admits event managers, so this admin-only
  // page must re-assert full group admin (and gives us the viewer identity).
  // Owner-only actions inside are gated per-control on `can_manage_admins`
  // from the API — admins land here for the read-only roster.
  const user = await requireGroupAdminPage(groupId);
  const [initial, group, removal, rankRoles] = await Promise.all([
    api.groupAuthorizedUsers(groupId),
    api.group(groupId),
    // Best-effort: the roster must still render if this read fails.
    api.groupDataRemoval(groupId).catch(() => ({ request: null, can_request: false })),
    // Best-effort as well; the panel says it couldn't load.
    api.groupRankRoles(groupId).catch(() => null),
  ]);

  return (
    <div className="space-y-4">
      <SettingsSectionShell
        id="rank-roles"
        label="Clan rank roles"
        blurb="Give members the Discord role for their in-game clan rank, from your WiseOldMan group, and keep it matched as ranks change."
      >
        <RankRolesPanel groupId={groupId} initial={rankRoles} />
      </SettingsSectionShell>
      <p className="text-osrs-parchment-dark/80 max-w-2xl text-sm">
        Admins manage this group — its settings, notifications, members, events, and the Discord
        bot&apos;s admin commands — without needing Discord server permissions. The{" "}
        <strong>owner</strong> is the only one who can change this list or hand the group to
        someone else.
      </p>
      <AuthorizedUsersManager
        groupId={groupId}
        groupName={group.name}
        initial={initial}
        viewerUserId={user.user_id}
      />
      <GroupDataRemovalPanel
        groupId={groupId}
        groupName={group.name}
        initial={removal.request}
        canRequest={removal.can_request}
      />
    </div>
  );
}
