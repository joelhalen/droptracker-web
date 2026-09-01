"use client";

import { useEffect, useState, useTransition } from "react";
import type { AccountSettings } from "@droptracker/api-types";
import { saveSettings, setPlayerHidden } from "@/app/(site)/(dashboard)/settings/actions";
import { getErrorMessage } from "@/lib/errors";
import { viewerZone } from "@/components/local-time";
import { Alert, Button } from "@/components/ui";
import { GpInput } from "@/components/gp-input";

type ToggleKey = Exclude<
  keyof AccountSettings,
  | "players"
  | "dm_min_value"
  | "supporter_entitlements"
  | "dm_delivery_issue"
  | "recap_timezone"
  | "recap_accounts"
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
  {
    key: "dm_monthly_recap",
    label: "DM me my monthly recap",
    help: "Send my recap card on the 1st of each month, covering the month just ended. Everyone gets their first one automatically — this keeps them coming.",
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
  const [zone, setZone] = useState(initial.recap_timezone);

  /* Seed the recap timezone from the browser the first time someone opens this
     page, so "midnight" means their midnight without anyone being asked to pick
     a zone from a list. Only ever written when unset — a later visit from a
     different machine (or on holiday) must not silently move their recap.
     Failure is ignored on purpose: an unset zone falls back to UTC, which is a
     worse time of day, not a broken feature. */
  useEffect(() => {
    if (initial.recap_timezone) return;
    const detected = viewerZone();
    if (!detected) return;
    setZone(detected);
    setSettings((s) => ({ ...s, recap_timezone: detected }));
    saveSettings({ recap_timezone: detected }).catch(() => {});
  }, [initial.recap_timezone]);

  // supporter_entitlements is read-only server state, and dm_delivery_issue
  // is dismiss-only (patched separately) — neither belongs in the form patch.
  const {
    players: _initialPlayers,
    supporter_entitlements: _initialEnts,
    dm_delivery_issue: _initialDmIssue,
    recap_timezone: _initialZone,
    ...initialToggles
  } = initial;
  const {
    players,
    supporter_entitlements: supporterEnts,
    dm_delivery_issue: _dmIssue,
    // Saved on detection, not by this form — leaving it in the patch would
    // light up the Save button the moment the page seeded a zone.
    recap_timezone: _zone,
    ...toggles
  } = settings;
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
          {zone && (
            <p className="text-osrs-parchment-dark/60 pl-7 text-xs">
              Recaps arrive around midday, {zone} — detected from this browser.
            </p>
          )}
          <RecapAccountPicker
            players={players}
            value={settings.recap_accounts}
            userHidden={settings.hidden}
            onChange={(recap_accounts) => setSettings((s) => ({ ...s, recap_accounts }))}
          />
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="heading-rule text-osrs-gold mb-3 w-full pb-1 text-lg font-semibold">
            Submission DMs{" "}
            <span className="text-osrs-gold-bright align-middle text-xs font-normal">
              (supporter perk)
            </span>
          </legend>
          {settings.dm_delivery_issue && (
            <Alert variant="error">
              <span className="block font-medium">We couldn&apos;t DM you last time.</span>
              <span className="mt-1 block text-xs">
                Your Discord privacy settings are blocking messages from the bot. In Discord, open
                the DropTracker server → click the server name → <strong>Privacy Settings</strong>{" "}
                → enable <strong>Direct Messages</strong> (you must also share a server with the
                bot). This notice clears automatically once a DM goes through.
              </span>
              <button
                type="button"
                onClick={() => {
                  setSettings((s) => ({ ...s, dm_delivery_issue: false }));
                  startTransition(async () => {
                    try {
                      await saveSettings({ dm_delivery_issue: false });
                    } catch {
                      /* dismiss is best-effort */
                    }
                  });
                }}
                className="border-osrs-bronze/40 hover:border-osrs-gold mt-2 rounded border px-2 py-1 text-xs"
              >
                Dismiss
              </button>
            </Alert>
          )}
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
            <GpInput
              min={0}
              disabled={!canDm}
              value={settings.dm_min_value}
              emptyAs={0}
              placeholder="0"
              hint="Every drop is DMed"
              onChange={(dm_min_value) => setSettings((s) => ({ ...s, dm_min_value }))}
              className="border-osrs-bronze/40 bg-osrs-surface-1 w-36 rounded border px-2 py-1 text-sm"
            />
            <span className="text-osrs-parchment-dark/60 text-xs">
              drops below this value are not DMed (0 = everything).
            </span>
          </label>
        </fieldset>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary" disabled={!dirty || pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
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

/**
 * Which account the monthly recap covers. Only shown to people who have more
 * than one linked: with a single account the choice is between one card and the
 * same card, and an extra control to read past is a cost paid by everyone to
 * serve nobody.
 */
function RecapAccountPicker({
  players,
  value,
  userHidden,
  onChange,
}: {
  players: AccountSettings["players"];
  value: string;
  userHidden: boolean;
  onChange: (value: string) => void;
}) {
  if (players.length < 2) return null;

  // A pick can outlive the account it named (unlinked since, or renamed away).
  // Without a matching option the select renders blank, which looks like the
  // setting was lost rather than pointing at something gone.
  const stale = value !== "" && value !== "all" && !players.some((p) => String(p.id) === value);
  const chosen = players.find((p) => String(p.id) === value);
  // Hidden accounts are excluded from recaps upstream, so naming one is a
  // silent "send me nothing" — worth saying out loud at the point of choosing.
  const chosenHidden = userHidden || Boolean(chosen?.hidden);

  return (
    <div className="space-y-1 pl-7">
      <label className="block text-sm font-medium" htmlFor="recap-accounts">
        Which account to recap
      </label>
      <select
        id="recap-accounts"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-osrs-bronze/40 bg-osrs-surface-1 w-full max-w-xs rounded border px-2 py-1 text-sm"
      >
        <option value="">Whichever had the biggest month (default)</option>
        <option value="all">Every account — one card each</option>
        {players.map((p) => (
          <option key={p.id} value={String(p.id)}>
            {p.name}
            {p.hidden ? " (hidden)" : ""}
          </option>
        ))}
        {stale && <option value={value}>Account #{value} (no longer linked)</option>}
      </select>
      <p className="text-osrs-parchment-dark/60 text-xs">
        Naming one account sends only that account&apos;s card — if it tracked nothing that
        month, no recap goes out. Every account sends one card per account you played, and
        applies once &ldquo;DM me my monthly recap&rdquo; is on above; the first, free recap is
        always a single card.
      </p>
      {chosenHidden && (
        <p className="text-osrs-red text-xs">
          {userHidden
            ? "“Hide me everywhere” is on, so no recaps are sent for any account."
            : "That account is hidden, so no recap will be sent for it."}
        </p>
      )}
      {stale && (
        <p className="text-osrs-red text-xs">
          That account isn&apos;t linked to you any more — pick another, or recaps will stop.
        </p>
      )}
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
