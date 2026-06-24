import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { MembersManager } from "@/components/members-manager";

export const metadata: Metadata = { title: "Members" };

type Params = Promise<{ id: string }>;

export default async function GroupMembersAdminPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  const page = await api.groupMembers(groupId, 1);

  return <MembersManager groupId={groupId} members={page.members} total={page.meta.total} />;
}
