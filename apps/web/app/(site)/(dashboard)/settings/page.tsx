import type { Metadata } from "next";
import { api } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { SettingsForm } from "@/components/settings-form";
import { NitroBoostCard } from "@/components/nitro-boost-card";
import { ThemePicker } from "@/components/theme";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  // requireUser guarantees a non-null session even though the layout also gates.
  await requireUser("/settings");
  const [settings, nitro] = await Promise.all([api.settings(), api.myNitroBoost()]);

  return (
    <div className="max-w-2xl space-y-10">
      <section>
        <h1 className="text-osrs-gold mb-2 text-2xl font-bold">Settings</h1>
        <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Appearance</h2>
        <p className="text-osrs-parchment-dark/70 mb-4 text-sm">
          Pick a site theme — stored on this device, applied instantly. Also available from the
          palette icon in the header.
        </p>
        <ThemePicker />
      </section>

      {/* SettingsForm renders its own "Privacy" / "Discord notifications" headings. */}
      <section className="max-w-xl">
        <SettingsForm initial={settings} />
      </section>

      <NitroBoostCard initial={nitro} />
    </div>
  );
}
