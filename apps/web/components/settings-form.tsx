"use client";

import { useState, useTransition } from "react";
import type { AccountSettings, Me } from "@droptracker/api-types";
import { saveSettings } from "@/app/(dashboard)/settings/actions";

type ToggleKey = Exclude<keyof AccountSettings, "patreon_group" | "premium_group">;

const TOGGLES: { key: ToggleKey; label: string; help: string }[] = [
  { key: "public", label: "Public profile", help: "Show my profile and loot on the site." },
  { key: "hidden", label: "Hidden", help: "Hide me from leaderboards entirely." },
  { key: "global_ping", label: "Global pings", help: "Allow @-pings in the global server." },
  { key: "group_ping", label: "Group pings", help: "Allow @-pings in my groups." },
  { key: "never_ping", label: "Never ping", help: "Never @-ping me anywhere (overrides above)." },
  { key: "dm_on_rank_change", label: "DM on rank change", help: "DM me when my rank changes." },
  { key: "dm_on_points", label: "DM on points", help: "DM me when I earn or spend points." },
  { key: "update_logs_opt_in", label: "Update logs", help: "Receive DropTracker update logs." },
];

export function SettingsForm({ initial, groups }: { initial: AccountSettings; groups: Me["groups"] }) {
  const [settings, setSettings] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const dirty = JSON.stringify(settings) !== JSON.stringify(initial);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <fieldset className="space-y-3">
        <legend className="heading-rule text-osrs-gold mb-3 w-full pb-1 text-lg font-semibold">
          Notifications &amp; privacy
        </legend>
        {TOGGLES.map((t) => (
          <label key={t.key} className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={settings[t.key]}
              onChange={(e) => setSettings((s) => ({ ...s, [t.key]: e.target.checked }))}
              className="mt-1 size-4"
            />
            <span>
              <span className="block text-sm font-medium">{t.label}</span>
              <span className="text-osrs-parchment-dark/60 block text-xs">{t.help}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="heading-rule text-osrs-gold mb-3 w-full pb-1 text-lg font-semibold">
          Premium
        </legend>
        <GroupSelect
          label="Patreon group"
          help="Group your Patreon benefits apply to."
          value={settings.patreon_group}
          groups={groups}
          onChange={(v) => setSettings((s) => ({ ...s, patreon_group: v }))}
        />
        <GroupSelect
          label="Premium group"
          help="Preferred group for premium features."
          value={settings.premium_group}
          groups={groups}
          onChange={(v) => setSettings((s) => ({ ...s, premium_group: v }))}
        />
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!dirty || pending}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saved && <span className="text-osrs-green text-sm">Saved.</span>}
      </div>
    </form>
  );
}

function GroupSelect({
  label,
  help,
  value,
  groups,
  onChange,
}: {
  label: string;
  help: string;
  value: number | null;
  groups: Me["groups"];
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium">{label}</span>
      <span className="text-osrs-parchment-dark/60 mb-1 block text-xs">{help}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="border-osrs-bronze/40 bg-osrs-brown-dark/40 rounded border px-3 py-1.5 text-sm"
      >
        <option value="">None</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
    </label>
  );
}
