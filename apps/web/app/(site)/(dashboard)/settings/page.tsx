import type { Metadata } from "next";
import { MEMBER_MESSAGE_TYPES, type MemberMessageType, type MyDeathMessages } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { SettingsForm } from "@/components/settings-form";
import { EventNotificationPrefs } from "@/components/event-notification-prefs";
import { MemberDeathMessages } from "@/components/member-death-messages";
import { NitroBoostCard } from "@/components/nitro-boost-card";
import { ThemePicker } from "@/components/theme";
import { AccountDataRemoval } from "@/components/data-removal";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  // requireUser guarantees a non-null session even though the layout also gates.
  const user = await requireUser("/settings");
  const [settings, nitro, notificationPrefs, memberMessages, removals] = await Promise.all([
    api.settings(),
    api.myNitroBoost(),
    api.notificationPrefs(),
    // Best-effort per type: the rest of the page must still render if a read fails.
    Promise.all(
      MEMBER_MESSAGE_TYPES.map((t) => api.myDeathMessages(t).catch(() => null)),
    ),
    api.myDataRemovals().catch(() => ({ requests: [] })),
  ]);
  const messagesByType: Partial<Record<MemberMessageType, MyDeathMessages>> = {};
  MEMBER_MESSAGE_TYPES.forEach((t, i) => {
    const data = memberMessages[i];
    if (data && data.players.length > 0) messagesByType[t] = data;
  });

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

      {Object.keys(messagesByType).length > 0 && (
        <section className="max-w-xl">
          <MemberDeathMessages initialByType={messagesByType} />
        </section>
      )}

      <section className="max-w-xl">
        <EventNotificationPrefs initial={notificationPrefs} />
      </section>

      <NitroBoostCard initial={nitro} />

      <section className="max-w-xl">
        <AccountDataRemoval
          accounts={user.players.map((p) => ({ id: p.id, name: p.name }))}
          initial={removals.requests}
        />
      </section>
    </div>
  );
}
