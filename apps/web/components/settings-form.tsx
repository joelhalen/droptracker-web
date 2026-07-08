"use client";

import { useState, useTransition } from "react";
import type { AccountSettings } from "@droptracker/api-types";
import { saveSettings, setPlayerHidden } from "@/app/(dashboard)/settings/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";

type ToggleKey = Exclude<
  keyof AccountSettings,
  "players" | "dm_min_value" | "supporter_entitlements"
>;

const PRIVACY_TOGGLES: { key: ToggleKey; label: string; help: string }[] = [
  {
    key: "hidden",
    label: "Hide me everywhere",
    help: "Remove all my accounts from public leaderboards, search, profiles, and the live drop feed.",
  },
];

const NOTIFICATION_TOGGLES: { key: ToggleKey; label: string; help: string }[] = [
  {
    key: "global_ping",
    label: "Ping me in the global server",
    help: "@-mention me when my submissions are posted in the DropTracker Discord.",
  },
  {
    key: "group_ping",
    label: "Ping me in my groups",
    help: "@-mention me when my submissions are posted in my groups' Discord servers.",
  },
  {
    key: "never_ping",
    label: "Never ping me",
    help: "Never @-mention me anywhere (overrides both options above).",
  },
  {
    key: "dm_account_changes",
    label: "DM me on account name changes",
    help: "Send me a Discord DM when a name change is detected on one of my accounts.",
  },
];

/** Supporter perk: per-type DMs for the user's own submissions. */
const SUBMISSION_DM_TOGGLES: { key: ToggleKey; label: string }[] = [
  { key: "dm_drops", label: "Drops" },
  { key: "dm_pbs", label: "Personal bests" },
  { key: "dm_clogs", label: "Collection log slots" },
  { key: "dm_cas", label: "Combat achievements" },
  { key: "dm_pets", label: "Pets" },
  { key: "dm_quests", label: "Quest completions" },
  { key: "dm_diaries", label: "Achievement diaries" },
  { key: "dm_deaths", label: "Deaths" },
  { key: "dm_levels", label: "Level ups" },
];

export function SettingsForm({ initial }: { initial: AccountSettings }) {
  const [settings, setSettings] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // supporter_entitlements is read-only server state — never part of the patch.
  const {
    players: _initialPlayers,
    supporter_entitlements: _initialEnts,
    ...initialToggles
  } = initial;
  const { players, supporter_entitlements: supporterEnts, ...toggles } = settings;
  const dirty = JSON.stringify(toggles) !== JSON.stringify(initialToggles);
  const canDm = Boolean(supporterEnts?.dm_submissions);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveSettings(toggles);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't save your settings. Please try again."));
      }
    });
  };

  const renderToggle = (t: { key: ToggleKey; label: string; help: string }) => (
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
  );

  const renderDmToggle = (t: { key: ToggleKey; label: string }) => (
    <label
      key={t.key}
      className={`flex items-center gap-2 ${canDm ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
    >
      <input
        type="checkbox"
        disabled={!canDm}
        checked={settings[t.key]}
        onChange={(e) => setSettings((s) => ({ ...s, [t.key]: e.target.checked }))}
        className="size-4"
      />
      <span className="text-sm">{t.label}</span>
    </label>
  );

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="space-y-8">
        <fieldset className="space-y-3">
          <legend className="heading-rule text-osrs-gold mb-3 w-full pb-1 text-lg font-semibold">
            Privacy
          </legend>
          {PRIVACY_TOGGLES.map(renderToggle)}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="heading-rule text-osrs-gold mb-3 w-full pb-1 text-lg font-semibold">
            Discord notifications
          </legend>
          {NOTIFICATION_TOGGLES.map(renderToggle)}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="heading-rule text-osrs-gold mb-3 w-full pb-1 text-lg font-semibold">
            Submission DMs{" "}
            <span className="text-osrs-gold-bright align-middle text-xs font-normal">
              (supporter perk)
            </span>
          </legend>
          {canDm ? (
            <p className="text-osrs-parchment-dark/60 text-xs">
              DM me on Discord when one of my own submissions is processed. Pick the types you
              care about — these are personal messages, independent of any group&apos;s channels.
            </p>
          ) : (
            <p className="text-osrs-parchment-dark/60 text-xs">
              Get a personal Discord DM for your own drops, personal bests and other achievements.{" "}
              <a href="/premium" className="text-osrs-gold-bright hover:underline">
                Become a supporter →
              </a>
            </p>
          )}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {SUBMISSION_DM_TOGGLES.map(renderDmToggle)}
          </div>
          <label
            className={`flex flex-wrap items-center gap-2 ${canDm ? "" : "cursor-not-allowed opacity-50"}`}
          >
            <span className="text-sm font-medium">Minimum drop value</span>
            <input
              type="number"
              min={0}
              step={1000}
              disabled={!canDm}
              value={settings.dm_min_value}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  dm_min_value: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                }))
              }
              className="border-osrs-bronze/40 bg-osrs-surface-1 w-36 rounded border px-2 py-1 text-sm"
            />
            <span className="text-osrs-parchment-dark/60 text-xs">
              gp — drops below this value are not DMed (0 = everything).
            </span>
          </label>
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
        {error && <Alert variant="error">{error}</Alert>}
      </form>

      <AccountVisibility
        players={players}
        userHidden={settings.hidden}
        onUpdated={(next) => setSettings((s) => ({ ...s, players: next.players }))}
      />
    </div>
  );
}

/** Per-account visibility — applies immediately, independent of the form above. */
function AccountVisibility({
  players,
  userHidden,
  onUpdated,
}: {
  players: AccountSettings["players"];
  userHidden: boolean;
  onUpdated: (settings: AccountSettings) => void;
}) {
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (players.length === 0) return null;

  const toggle = async (id: number, hidden: boolean) => {
    setError(null);
    setPendingId(id);
    try {
      onUpdated(await setPlayerHidden(id, hidden));
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't update that account. Please try again."));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
        Account visibility
      </h2>
      <p className="text-osrs-parchment-dark/60 text-xs">
        Hide individual accounts from public leaderboards, search, and profiles. Changes apply
        immediately.
        {userHidden && " While “Hide me everywhere” is on, every account is already hidden."}
      </p>
      <ul className="space-y-2">
        {players.map((p) => (
          <li
            key={p.id}
            className="border-osrs-bronze/30 flex items-center justify-between rounded border px-3 py-2"
          >
            <span className="text-sm font-medium">{p.name}</span>
            <button
              type="button"
              disabled={pendingId !== null}
              onClick={() => toggle(p.id, !p.hidden)}
              className="border-osrs-bronze/40 hover:border-osrs-gold rounded border px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              aria-pressed={p.hidden}
            >
              {pendingId === p.id ? "Saving…" : p.hidden ? "Hidden" : "Visible"}
            </button>
          </li>
        ))}
      </ul>
      {error && <Alert variant="error">{error}</Alert>}
    </section>
  );
}
