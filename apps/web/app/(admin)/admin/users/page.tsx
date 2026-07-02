import type { Metadata } from "next";
import { api } from "@/lib/api";
import { UserPicker } from "@/components/admin/user-picker";
import { UserOverviewPanel } from "@/components/admin/user-overview-panel";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ userId?: string }>;

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const { userId: rawId } = await searchParams;
  const userId = rawId ? Number(rawId) : NaN;
  // user_id 0 is a real row in this system (unlike group/player ids) — do not
  // exclude it with a `> 0` guard.
  const hasUser = Number.isFinite(userId) && Number.isInteger(userId);

  const viewer = await getUser();
  let overview: Awaited<ReturnType<typeof api.adminUserOverview>> | null = null;
  let error: string | null = null;

  if (hasUser) {
    try {
      overview = await api.adminUserOverview(userId);
    } catch (e) {
      error = (e as Error).message || "Failed to load user.";
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-osrs-parchment-dark/70 text-sm">
        Look up a user by Discord ID or username, view their linked accounts and groups, and
        manage superadmin access.
      </p>

      <UserPicker initial={hasUser ? String(userId) : ""} />

      {!hasUser ? (
        <div className="border-osrs-bronze/20 text-osrs-parchment-dark/60 rounded border p-6 text-center text-sm">
          Search for a user above to begin.
        </div>
      ) : error ? (
        <div className="border-osrs-red/40 bg-osrs-red/10 text-osrs-red rounded border p-4 text-sm">
          {error}
        </div>
      ) : overview ? (
        <UserOverviewPanel overview={overview} viewerUserId={viewer?.user_id ?? null} />
      ) : null}
    </div>
  );
}
