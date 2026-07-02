import type { Metadata } from "next";
import { api } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { SettingsForm } from "@/components/settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  // requireUser guarantees a non-null session even though the layout also gates.
  const user = await requireUser("/settings");
  const settings = await api.settings();

  return (
    <div className="max-w-xl">
      <h1 className="text-osrs-gold mb-6 text-2xl font-bold">Settings</h1>
      <SettingsForm initial={settings} groups={user.groups} />
    </div>
  );
}
