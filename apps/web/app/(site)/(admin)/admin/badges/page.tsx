import type { Metadata } from "next";
import { api } from "@/lib/api";
import { BadgeManager } from "@/components/admin/badge-manager";

export const metadata: Metadata = { title: "Badges" };

export default async function AdminBadgesPage() {
  const badges = await api.adminBadges();

  return (
    <div className="max-w-3xl">
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Badge definitions and manual awards. Automatic badges (daily champion, streaks, boss
        records) are evaluated by the backend — their criteria are code-owned; you can edit their
        name, colour, and icon here. Badges you create here are manual-only.
      </p>
      <BadgeManager badges={badges} />
    </div>
  );
}
