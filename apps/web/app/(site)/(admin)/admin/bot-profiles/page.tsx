import type { Metadata } from "next";
import { api } from "@/lib/api";
import { requireDeveloper } from "@/lib/auth";
import { BotProfilesGallery } from "@/components/admin/bot-profiles-gallery";

export const metadata: Metadata = { title: "Bot profiles" };
export const dynamic = "force-dynamic";

export default async function AdminBotProfilesPage() {
  const user = await requireDeveloper("/admin/bot-profiles");

  let profiles: Awaited<ReturnType<typeof api.adminBotProfiles>>["profiles"] = [];
  let error: string | null = null;
  try {
    profiles = (await api.adminBotProfiles()).profiles;
  } catch (e) {
    error = (e as Error).message || "Failed to load bot profiles.";
  }

  return (
    <div className="space-y-6">
      <p className="text-osrs-parchment-dark/70 text-sm">
        Groups on Sponsor or Patron can give the bot their own name, avatar, banner and bio in their
        server. Changes go live without review, so they are all listed here, newest first. Every
        change is also in the audit log. When a subscription ends the bot goes back to its normal
        look on its own.
      </p>
      {error ? (
        <div className="border-osrs-red/40 bg-osrs-red/10 text-osrs-red rounded border p-4 text-sm">{error}</div>
      ) : (
        <BotProfilesGallery profiles={profiles} canReset={Boolean(user.is_superadmin)} />
      )}
    </div>
  );
}
