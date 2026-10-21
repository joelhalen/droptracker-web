import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { requireGroupAdminPage } from "@/lib/auth";
import { PageBuilder } from "@/components/page-builder/page-builder";

export const metadata: Metadata = { title: "Page design" };
export const dynamic = "force-dynamic";

/**
 * Page builder for a group (web137a): the public group page, or with
 * `?for=members` the default profile layout for the group's members. Any
 * admin can design and preview; publishing needs the custom_site perk
 * (checked by the Web API, surfaced as an upgrade prompt in the builder).
 */
export default async function GroupPageBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ for?: string }>;
}) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();
  await requireGroupAdminPage(groupId);
  const members = (await searchParams).for === "members";
  const scope = members ? "member_default" : "group";
  const [group, state] = await Promise.all([
    api.group(groupId),
    api.layoutBuilderState(scope, groupId),
  ]);
  const base = `/groups/${groupId}/page-builder`;
  return (
    <PageBuilder
      key={scope}
      scope={scope}
      subjectId={groupId}
      initial={state}
      title={members ? `${group.name}: member profiles` : group.name}
      previewUrl={`/groups/${groupId}/preview${members ? "?for=members" : ""}`}
      liveUrl={`/groups/${groupId}`}
      exitUrl={`/groups/${groupId}/admin`}
      upgradeUrl={`/groups/${groupId}/subscription`}
      groupId={groupId}
      tabs={[
        { label: "Group page", href: base, active: !members },
        { label: "Member profiles", href: `${base}?for=members`, active: members },
      ]}
    />
  );
}
