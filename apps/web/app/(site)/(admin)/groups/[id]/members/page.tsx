import type { Metadata } from "next";
import { requireGroupAdminPage } from "@/lib/auth";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { MembersManager } from "@/components/members-manager";
import { normalizeQuery } from "@/lib/points-leaderboard";

export const metadata: Metadata = { title: "Members" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ page?: string; q?: string }>;

export default async function GroupMembersAdminPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const groupId = Number(id);
  await requireGroupAdminPage(groupId); // web64a: event managers only reach Events
  if (!Number.isFinite(groupId)) notFound();

  const { page: pageParam, q: qParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? "1") || 1);
  const q = normalizeQuery(qParam);

  const data = await api.groupMembers(groupId, page, q || undefined);

  return (
    <MembersManager
      groupId={groupId}
      members={data.members}
      total={data.meta.total}
      page={data.meta.page || page}
      limit={data.meta.limit || 25}
      query={q}
    />
  );
}
