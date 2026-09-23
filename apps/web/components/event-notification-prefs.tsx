"use client";

import { useState } from "react";
import type { NotificationPrefs } from "@droptracker/api-types";
import { savePlayerNotificationPrefs } from "@/app/(site)/(dashboard)/settings/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";

/**
 * Per-account toggles for in-game (RuneLite plugin) notifications: event
 * notifications plus the routine "Drop processed" chat line. Types come from
 * the server, so new notification types show up here without a frontend
 * change. Each toggle applies immediately (AccountVisibility pattern).
 * Task-progress pop-ups are deliberately not listed — that mute switch lives
 * in the plugin config. Drop confirmations are the one exception that exists
 * in both places: plugin 6.0.10+ sends its own setting, which wins, and this
 * one covers older builds.
 */
export function EventNotificationPrefs({ initial }: { initial: NotificationPrefs }) {
  const [data, setData] = useState(initial);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (data.players.length === 0 || data.types.length === 0) return null;

  const toggle = async (playerId: number, typeKey: string, enabled: boolean) => {
    setError(null);
    setPendingKey(`${playerId}:${typeKey}`);
    const player = data.players.find((p) => p.id === playerId);
    if (!player) return;
    try {
      setData(await savePlayerNotificationPrefs(playerId, { ...player.prefs, [typeKey]: enabled }));
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't update that preference. Please try again."));
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
        In-game notifications
      </h2>
      <p className="text-osrs-parchment-dark/60 text-xs">
        Choose what each account sees in RuneLite: event updates (task completions, lead changes,
        board turns) and the &ldquo;Drop processed&rdquo; chat line you get when a drop is sent
        to your group. Requires the DropTracker plugin with the API enabled. Whether anything
        shows at all, and whether teammates&apos; task <em>progress</em> pops up, is set in the
        plugin&apos;s own settings. Changes apply immediately.
      </p>
      <p className="text-osrs-parchment-dark/60 text-xs">
        Newer plugin versions have their own <strong>Drop confirmations</strong> setting. If your
        plugin has it, that setting is used instead of the one here.
      </p>
      <ul className="space-y-3">
        {data.players.map((p) => (
          <li key={p.id} className="border-osrs-bronze/30 rounded border px-3 py-2">
            <span className="mb-2 block text-sm font-medium">{p.name}</span>
            <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
              {data.types.map((t) => {
                const busy = pendingKey === `${p.id}:${t.key}`;
                return (
                  <label
                    key={t.key}
                    className={`flex items-center gap-2 ${busy ? "opacity-50" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      disabled={pendingKey !== null}
                      checked={p.prefs[t.key] ?? true}
                      onChange={(e) => toggle(p.id, t.key, e.target.checked)}
                      className="size-4"
                    />
                    <span className="text-sm">{busy ? "Saving…" : t.label}</span>
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      {error && <Alert variant="error">{error}</Alert>}
    </section>
  );
}
