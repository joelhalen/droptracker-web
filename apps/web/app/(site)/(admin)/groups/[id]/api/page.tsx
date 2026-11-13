import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { requireGroupAdminPage } from "@/lib/auth";
import { ApiAccessPanel } from "@/components/api-access";

export const metadata: Metadata = { title: "API access" };

// Request state changes when staff decide; never serve a stale "waiting".
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

/**
 * A group's Data API keys, and the form that asks for one (web163a). Group
 * admins only: a key reads the whole roster. Event managers do not reach it.
 */
export default async function GroupApiAccessPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();
  await requireGroupAdminPage(groupId);

  const [keys, requests] = await Promise.all([
    api.groupApiKeys(groupId),
    api.groupApiKeyRequests(groupId),
  ]);

  return (
    <ApiAccessPanel
      groupId={groupId}
      subject="this group"
      initialKeys={keys.keys}
      initialRequests={requests.requests}
      discordMember={requests.discord_member}
    />
  );
}
