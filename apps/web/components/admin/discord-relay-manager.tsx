"use client";

import { useState, useTransition } from "react";
import {
  DiscordRelayFeatures,
  type DiscordRelayFeature,
  type DiscordRelayIntegration,
  type DiscordRelayLog,
} from "@droptracker/api-types";
import {
  createDiscordRelay,
  deleteDiscordRelay,
  loadDiscordRelayLog,
  rotateDiscordRelayKey,
  updateDiscordRelay,
} from "@/app/(site)/(admin)/admin/discord-relay/actions";
import type { DiscordRelayInput } from "@/lib/api/discord-relay";
import { Alert, Card } from "@/components/ui";

/**
 * Staff surface for Discord delivery relays (web153a): which groups have their
 * own bot posting our messages, whether that bot is alive, and the switches
 * (activate / pause, edit, replace key, delete). "Is it alive" is the last
 * poll time: a bot that stopped polling means that server hears nothing until
 * someone pauses the relay, which hands posting back to our bot.
 */

const FEATURE_LABELS: Record<DiscordRelayFeature, string> = {
  events: "Events (notifications, live boards, sign-ups, reviews)",
  notifications: "Other notifications (drops, PBs, collection log). Not offered yet",
};

const inputClass = "w-full rounded border border-white/15 bg-black/30 px-2 py-1.5";

function agoUnix(seconds?: number): string {
  if (!seconds) return "never";
  const mins = Math.max(0, Math.round((Date.now() / 1000 - seconds) / 60));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

/** Polling within the last few minutes counts as alive (long-poll is 25s). */
export function relayHealth(r: DiscordRelayIntegration, nowSeconds = Date.now() / 1000) {
  if (r.status !== "active") return { tone: "muted", text: "Paused: our bot posts" } as const;
  const last = r.stats?.last_poll;
  if (!last) return { tone: "bad", text: "Active, but the bot has never polled" } as const;
  if (nowSeconds - last > 300) return { tone: "bad", text: `Active, bot silent since ${agoUnix(last)}` } as const;
  return { tone: "good", text: `Active, bot polled ${agoUnix(last)}` } as const;
}

export function parseIds(raw: string): string[] {
  return Array.from(new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)));
}

export function DiscordRelayManager({ initial }: { initial: DiscordRelayIntegration[] }) {
  const [relays, setRelays] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [freshToken, setFreshToken] = useState<{ id: number; token: string } | null>(null);

  function run<T>(action: () => Promise<{ ok: true; value: T } | { ok: false; error: string }>,
                  onOk: (value: T) => void) {
    setError(null);
    start(async () => {
      const result = await action();
      if (result.ok) onOk(result.value);
      else setError(result.error);
    });
  }

  function replace(updated: DiscordRelayIntegration) {
    setRelays((all) => all.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
    if (updated.token) setFreshToken({ id: updated.id, token: updated.token });
  }

  return (
    <div className="space-y-8">
      {error && <Alert variant="error">{error}</Alert>}

      {freshToken && (
        <Card>
          <h2 className="text-osrs-gold mb-2 font-semibold">Key for relay #{freshToken.id}: copy it now</h2>
          <p className="text-osrs-parchment-dark/70 mb-3 text-sm">
            This is the only time it is shown. Give it to the bot&apos;s operator.
          </p>
          <code className="block overflow-x-auto rounded border border-white/10 bg-black/60 px-3 py-2 text-sm text-emerald-100">
            {freshToken.token}
          </code>
          <button
            type="button"
            onClick={() => setFreshToken(null)}
            className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright mt-3 text-xs underline"
          >
            I&apos;ve stored it, hide
          </button>
        </Card>
      )}

      <CreateForm
        pending={pending}
        onCreate={(input) =>
          run(() => createDiscordRelay(input), (relay) => {
            setRelays((all) => [relay, ...all]);
            if (relay.token) setFreshToken({ id: relay.id, token: relay.token });
          })
        }
      />

      <section>
        <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Relays</h2>
        {relays.length === 0 ? (
          <Card>
            <p className="text-osrs-parchment-dark/70 text-sm">
              No relays yet. Create one above, or on the box with <code>scripts/relay_admin.py</code>.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {relays.map((relay) => (
              <RelayCard
                key={relay.id}
                relay={relay}
                pending={pending}
                onUpdate={(input) => run(() => updateDiscordRelay(relay.id, input), replace)}
                onRotate={() => run(() => rotateDiscordRelayKey(relay.id), replace)}
                onDelete={() =>
                  run(() => deleteDiscordRelay(relay.id),
                      () => setRelays((all) => all.filter((r) => r.id !== relay.id)))
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FeaturePicker({ value, onChange }: {
  value: DiscordRelayFeature[];
  onChange: (next: DiscordRelayFeature[]) => void;
}) {
  return (
    <div className="space-y-1">
      {DiscordRelayFeatures.map((f) => (
        <label key={f} className="text-osrs-parchment-dark/70 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.includes(f)}
            onChange={(e) =>
              onChange(e.target.checked ? [...value, f] : value.filter((x) => x !== f))
            }
          />
          {FEATURE_LABELS[f]}
        </label>
      ))}
    </div>
  );
}

function CreateForm({ pending, onCreate }: {
  pending: boolean;
  onCreate: (input: DiscordRelayInput) => void;
}) {
  const [groupId, setGroupId] = useState("");
  const [guilds, setGuilds] = useState("");
  const [appId, setAppId] = useState("");
  const [label, setLabel] = useState("");
  const [keyId, setKeyId] = useState("");
  const [features, setFeatures] = useState<DiscordRelayFeature[]>(["events"]);

  const gid = Number(groupId);
  const guildIds = parseIds(guilds);
  const valid = Number.isInteger(gid) && gid > 0 && guildIds.length > 0 && features.length > 0;

  return (
    <Card>
      <h2 className="text-osrs-gold mb-1 font-semibold">New relay</h2>
      <p className="text-osrs-parchment-dark/70 mb-4 text-sm">
        Mints a key for the group, or binds a key the group already uses for the Data API.
        Starts paused.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block">Group id</span>
          <input value={groupId} onChange={(e) => setGroupId(e.target.value)} inputMode="numeric"
                 placeholder="e.g. 299" className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block">Discord server id(s)</span>
          <input value={guilds} onChange={(e) => setGuilds(e.target.value)}
                 placeholder="comma separated" className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block">Their bot&apos;s application id</span>
          <input value={appId} onChange={(e) => setAppId(e.target.value)} inputMode="numeric"
                 placeholder="needed before activating" className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block">Label</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)}
                 placeholder="e.g. TrueGritty bot" className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block">Existing key id (optional)</span>
          <input value={keyId} onChange={(e) => setKeyId(e.target.value)} inputMode="numeric"
                 placeholder="blank mints a new key" className={inputClass} />
        </label>
      </div>
      <div className="mt-4">
        <FeaturePicker value={features} onChange={setFeatures} />
      </div>
      <button
        type="button"
        disabled={!valid || pending}
        onClick={() =>
          onCreate({
            group_id: gid,
            guild_ids: guildIds,
            application_id: appId.trim() || null,
            label: label.trim(),
            features,
            ...(keyId.trim() ? { api_key_id: Number(keyId) } : {}),
          })
        }
        className="bg-osrs-gold/90 hover:bg-osrs-gold-bright mt-4 rounded px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
      >
        Create relay
      </button>
    </Card>
  );
}

const TONE: Record<string, string> = {
  good: "text-emerald-300",
  bad: "text-red-300",
  muted: "text-osrs-parchment-dark/60",
};

function RelayCard({ relay, pending, onUpdate, onRotate, onDelete }: {
  relay: DiscordRelayIntegration;
  pending: boolean;
  onUpdate: (input: DiscordRelayInput) => void;
  onRotate: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [log, setLog] = useState<DiscordRelayLog | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const health = relayHealth(relay);
  const s = relay.stats;

  async function toggleLog() {
    if (log) return setLog(null);
    setLogError(null);
    const result = await loadDiscordRelayLog(relay.id);
    if (result.ok) setLog(result.value);
    else setLogError(result.error);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-osrs-gold font-semibold">
            #{relay.id} {relay.label || "Unnamed relay"}
          </h3>
          <p className="text-osrs-parchment-dark/70 text-sm">
            Group {relay.group_id}{relay.group_name ? ` (${relay.group_name})` : ""} · servers{" "}
            {relay.guild_ids.join(", ")} · app {relay.application_id ?? "not set"}
          </p>
          <p className={`text-sm ${TONE[health.tone]}`}>{health.text}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {relay.status === "active" ? (
            <button type="button" disabled={pending} onClick={() => onUpdate({ status: "paused" })}
                    className="rounded border border-white/20 px-2 py-1 text-xs hover:bg-white/10">
              Pause
            </button>
          ) : (
            <button type="button" disabled={pending} onClick={() => onUpdate({ status: "active" })}
                    className="rounded border border-emerald-400/40 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-400/10">
              Activate
            </button>
          )}
          <button type="button" onClick={() => setEditing((v) => !v)}
                  className="rounded border border-white/20 px-2 py-1 text-xs hover:bg-white/10">
            {editing ? "Close" : "Edit"}
          </button>
          <button type="button" onClick={toggleLog}
                  className="rounded border border-white/20 px-2 py-1 text-xs hover:bg-white/10">
            {log ? "Hide log" : "Delivery log"}
          </button>
        </div>
      </div>

      <dl className="text-osrs-parchment-dark/80 mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <div><dt className="opacity-60">Waiting</dt><dd>{s?.pending ?? 0}</dd></div>
        <div><dt className="opacity-60">Being sent</dt><dd>{s?.leased ?? 0}</dd></div>
        <div><dt className="opacity-60">Sent</dt><dd>{s?.sent ?? 0}</dd></div>
        <div><dt className="opacity-60">Failed / expired</dt><dd>{(s?.failed ?? 0)} / {(s?.expired ?? 0)}</dd></div>
        <div><dt className="opacity-60">Last ack</dt><dd>{agoUnix(s?.last_ack)}</dd></div>
        <div><dt className="opacity-60">Key</dt><dd>{relay.api_key ? `${relay.api_key.display}${relay.api_key.revoked ? " (revoked)" : ""}` : "none"}</dd></div>
        <div><dt className="opacity-60">Features</dt><dd>{relay.features.join(", ")}</dd></div>
        <div><dt className="opacity-60">Hold</dt><dd>{relay.hold_minutes} min</dd></div>
      </dl>

      {logError && <p className="mt-2 text-sm text-red-300">{logError}</p>}
      {log && (
        <div className="mt-3 max-h-72 overflow-auto rounded border border-white/10 bg-black/40 p-2 text-xs">
          {log.entries.length === 0 ? (
            <p className="opacity-60">Nothing delivered yet.</p>
          ) : (
            <table className="w-full">
              <tbody>
                {log.entries.map((e) => (
                  <tr key={`${e.id}-${e.at}`} className="border-b border-white/5">
                    <td className="pr-2 opacity-60">{new Date(e.at * 1000).toLocaleString()}</td>
                    <td className="pr-2">#{e.id} {e.op}</td>
                    <td className={`pr-2 ${e.status === "sent" ? "text-emerald-300" : "text-red-300"}`}>{e.status}</td>
                    <td className="pr-2 opacity-70">{e.ref}</td>
                    <td className="opacity-70">{e.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {editing && (
        <EditForm relay={relay} pending={pending} onSave={onUpdate} onRotate={onRotate} onDelete={onDelete} />
      )}
    </Card>
  );
}

function EditForm({ relay, pending, onSave, onRotate, onDelete }: {
  relay: DiscordRelayIntegration;
  pending: boolean;
  onSave: (input: DiscordRelayInput) => void;
  onRotate: () => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(relay.label);
  const [appId, setAppId] = useState(relay.application_id ?? "");
  const [guilds, setGuilds] = useState(relay.guild_ids.join(", "));
  const [hold, setHold] = useState(String(relay.hold_minutes));
  const [notes, setNotes] = useState(relay.notes ?? "");
  const [features, setFeatures] = useState<DiscordRelayFeature[]>(relay.features);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block">Label</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block">Application id</span>
          <input value={appId} onChange={(e) => setAppId(e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block">Server id(s)</span>
          <input value={guilds} onChange={(e) => setGuilds(e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block">Hold new messages (min)</span>
          <input value={hold} onChange={(e) => setHold(e.target.value)} inputMode="numeric" className={inputClass} />
        </label>
      </div>
      <label className="mt-3 block text-sm">
        <span className="text-osrs-parchment-dark/70 mb-1 block">Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </label>
      <div className="mt-3">
        <FeaturePicker value={features} onChange={setFeatures} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || features.length === 0}
          onClick={() =>
            onSave({
              label: label.trim(),
              application_id: appId.trim() || null,
              guild_ids: parseIds(guilds),
              hold_minutes: Number(hold),
              notes: notes.trim() || null,
              features,
            })
          }
          className="bg-osrs-gold/90 hover:bg-osrs-gold-bright rounded px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
        >
          Save
        </button>
        <button type="button" disabled={pending} onClick={onRotate}
                className="rounded border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10">
          Replace key
        </button>
        {confirmDelete ? (
          <button type="button" disabled={pending} onClick={onDelete}
                  className="rounded border border-red-400/50 px-3 py-1.5 text-sm text-red-200 hover:bg-red-400/10">
            Really delete (revokes its key)
          </button>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)}
                  className="rounded border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10">
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
