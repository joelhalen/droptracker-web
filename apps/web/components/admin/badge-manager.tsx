"use client";

import { useState, useTransition } from "react";
import type { AdminBadge, AdminBadgeInput, BadgeTone, PlayerBadge } from "@droptracker/api-types";
import { BadgeToneSchema } from "@droptracker/api-types";
import { Badge } from "@/components/ui";
import { badgeDetail } from "@/components/player-badges";
import { formatDate } from "@/lib/format";
import {
  awardBadge,
  deleteBadge,
  listPlayerBadges,
  lookupPlayers,
  revokeBadge,
  saveBadge,
} from "@/app/(site)/(admin)/admin/badges/actions";

const TONES = BadgeToneSchema.options;

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";

const blankBadge = (): AdminBadge => ({
  key: "",
  name: "",
  description: "",
  tone: "gold",
  semantic: "permanent",
  active: true,
  automatic: false,
  active_awards: 0,
});

export function BadgeManager({ badges }: { badges: AdminBadge[] }) {
  const [editing, setEditing] = useState<{ badge: AdminBadge; isNew: boolean } | null>(null);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-osrs-gold text-lg font-semibold">Definitions</h2>
          <button
            onClick={() => setEditing({ badge: blankBadge(), isNew: true })}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium"
          >
            + New badge
          </button>
        </div>

        <ul className="divide-osrs-bronze/20 divide-y">
          {badges.map((b) => (
            <li key={b.key} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="flex items-center gap-2">
                <Badge tone={b.tone} title={b.description}>
                  <span aria-hidden>{b.icon_emoji ?? "★"}</span>
                  {b.name}
                </Badge>
                <span className="text-osrs-parchment-dark/50 text-xs">{b.key}</span>
                {b.automatic && <Badge tone="sky">Automatic</Badge>}
                {b.semantic === "held" && <Badge tone="ember">Held</Badge>}
                {!b.active && <Badge tone="red">Inactive</Badge>}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-osrs-parchment-dark/60 tabular-nums">
                  {b.active_awards} active
                </span>
                <button
                  onClick={() => setEditing({ badge: b, isNew: false })}
                  className="text-osrs-gold-bright hover:underline"
                >
                  Edit
                </button>
              </div>
            </li>
          ))}
          {!badges.length && (
            <li className="text-osrs-parchment-dark/60 py-3 text-sm">No badges defined yet.</li>
          )}
        </ul>

        {editing && (
          <BadgeForm
            key={editing.badge.key || "new"}
            badge={editing.badge}
            isNew={editing.isNew}
            onClose={() => setEditing(null)}
          />
        )}
      </section>

      <AwardPanel badges={badges.filter((b) => b.active)} />
    </div>
  );
}

function BadgeForm({
  badge,
  isNew,
  onClose,
}: {
  badge: AdminBadge;
  isNew: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState<AdminBadge>(badge);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof AdminBadge>(k: K, v: AdminBadge[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Semantics are locked once a badge has awards (backend enforces too).
  const semanticLocked = !isNew && (badge.automatic || badge.active_awards > 0);

  const onSave = () =>
    startTransition(async () => {
      const input: AdminBadgeInput = {
        key: form.key,
        name: form.name,
        description: form.description,
        tone: form.tone,
        semantic: form.semantic,
        icon_url: form.icon_url ?? undefined,
        icon_emoji: form.icon_emoji ?? undefined,
        active: form.active,
      };
      const res = await saveBadge(input);
      if ("error" in res && res.error) setError(res.error);
      else onClose();
    });

  const onDelete = () =>
    startTransition(async () => {
      const res = await deleteBadge(form.key);
      if ("error" in res && res.error) setError(res.error);
      else onClose();
    });

  return (
    <div className="border-osrs-gold/40 space-y-4 rounded border p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-osrs-gold font-semibold">
          {isNew ? "New manual badge" : `Edit ${badge.name}`}
        </h3>
        <button
          onClick={onClose}
          className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
        >
          Close
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Key</span>
          <input
            value={form.key}
            onChange={(e) =>
              set("key", e.target.value.replace(/\s+/g, "_").replace(/[^a-z0-9_]/gi, "").toLowerCase())
            }
            disabled={!isNew}
            className={`${field} disabled:opacity-60`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Name</span>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Tone</span>
          <select
            value={form.tone}
            onChange={(e) => set("tone", e.target.value as BadgeTone)}
            className={field}
          >
            {TONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Semantic</span>
          <select
            value={form.semantic}
            onChange={(e) => set("semantic", e.target.value as AdminBadge["semantic"])}
            disabled={semanticLocked}
            className={`${field} disabled:opacity-60`}
          >
            <option value="permanent">Permanent (kept forever)</option>
            <option value="held">Held (one current holder)</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Emoji</span>
          <input
            value={form.icon_emoji ?? ""}
            onChange={(e) => set("icon_emoji", e.target.value || null)}
            placeholder="🏆"
            className={field}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Icon URL (optional override)</span>
          <input
            value={form.icon_url ?? ""}
            onChange={(e) => set("icon_url", e.target.value || null)}
            placeholder="https://www.droptracker.io/img/…"
            className={field}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Description</span>
        <input
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className={field}
        />
      </label>

      <div className="flex items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => set("active", e.target.checked)}
            className="size-4"
          />
          Active (visible on the site)
        </label>
        <span className="text-osrs-parchment-dark/60 text-xs">Preview:</span>
        <Badge tone={form.tone}>
          <span aria-hidden>{form.icon_emoji ?? "★"}</span>
          {form.name || "Badge"}
        </Badge>
      </div>

      {error && <p className="text-osrs-red text-sm">{error}</p>}

      <div className="flex items-center justify-between">
        <button
          onClick={onSave}
          disabled={pending || !form.key || !form.name || !form.description}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save badge"}
        </button>
        {!isNew && form.active && (
          <button
            onClick={onDelete}
            disabled={pending}
            className="text-osrs-red hover:bg-osrs-red/10 rounded px-3 py-2 text-sm disabled:opacity-50"
            title="Soft delete: hides the badge and all its awards"
          >
            Deactivate
          </button>
        )}
      </div>
    </div>
  );
}

type PlayerHit = { id: string; label: string; detail?: string };

function AwardPanel({ badges }: { badges: AdminBadge[] }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [player, setPlayer] = useState<PlayerHit | null>(null);
  const [awards, setAwards] = useState<PlayerBadge[]>([]);
  const [badgeKey, setBadgeKey] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const refreshAwards = (playerId: number) =>
    startTransition(async () => {
      setAwards(await listPlayerBadges(playerId));
    });

  const onSearch = () =>
    startTransition(async () => {
      setMessage(null);
      setPlayer(null);
      setAwards([]);
      setHits(await lookupPlayers(query));
    });

  const onPick = (hit: PlayerHit) => {
    setPlayer(hit);
    setHits([]);
    setMessage(null);
    refreshAwards(Number(hit.id));
  };

  const onAward = () =>
    startTransition(async () => {
      if (!player || !badgeKey) return;
      const res = await awardBadge(Number(player.id), badgeKey, note.trim() || undefined);
      if ("error" in res && res.error) {
        setMessage({ ok: false, text: res.error });
      } else {
        setMessage({ ok: true, text: `Awarded to ${player.label}.` });
        setNote("");
        refreshAwards(Number(player.id));
      }
    });

  const onRevoke = (awardId: number) =>
    startTransition(async () => {
      if (!player) return;
      if (!window.confirm("Revoke this badge award? It stays in history as revoked.")) return;
      const res = await revokeBadge(Number(player.id), awardId);
      if ("error" in res && res.error) setMessage({ ok: false, text: res.error });
      else {
        setMessage({ ok: true, text: "Award revoked." });
        refreshAwards(Number(player.id));
      }
    });

  return (
    <section className="space-y-4">
      <h2 className="text-osrs-gold text-lg font-semibold">Award / revoke</h2>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder="Search players by name…"
          className={field}
        />
        <button
          onClick={onSearch}
          disabled={pending || !query.trim()}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark shrink-0 rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Search
        </button>
      </div>

      {hits.length > 0 && (
        <ul className="border-osrs-bronze/20 divide-osrs-bronze/20 divide-y rounded border">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                onClick={() => onPick(h)}
                className="hover:bg-osrs-gold/10 flex w-full items-center justify-between px-3 py-2 text-left text-sm"
              >
                <span className="font-medium">{h.label}</span>
                <span className="text-osrs-parchment-dark/50 text-xs">
                  {h.detail ?? `#${h.id}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {player && (
        <div className="border-osrs-gold/40 space-y-4 rounded border p-5">
          <h3 className="text-osrs-gold font-semibold">{player.label}</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Badge</span>
              <select value={badgeKey} onChange={(e) => setBadgeKey(e.target.value)} className={field}>
                <option value="">Select a badge…</option>
                {badges.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.name} ({b.key})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Note (optional, shown on profile)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} className={field} />
            </label>
          </div>

          <button
            onClick={onAward}
            disabled={pending || !badgeKey}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Working…" : "Award badge"}
          </button>

          {message && (
            <p className={`text-sm ${message.ok ? "text-osrs-green" : "text-osrs-red"}`}>
              {message.text}
            </p>
          )}

          <div>
            <h4 className="text-osrs-parchment mb-2 text-sm font-semibold">Current awards</h4>
            {awards.length ? (
              <ul className="divide-osrs-bronze/20 divide-y text-sm">
                {awards.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="flex items-center gap-2">
                      <Badge tone={a.tone}>
                        {a.icon_url ? (
                          <img src={a.icon_url} alt="" className="size-3.5 shrink-0 object-contain" />
                        ) : (
                          <span aria-hidden>{a.icon_emoji ?? "★"}</span>
                        )}
                        {a.name}
                        {badgeDetail(a.key, a.context as Record<string, unknown> | null) && (
                          <span className="font-normal opacity-80">
                            ({badgeDetail(a.key, a.context as Record<string, unknown> | null)})
                          </span>
                        )}
                      </Badge>
                      <span className="text-osrs-parchment-dark/50 text-xs">
                        {a.status} · {formatDate(a.awarded_at_ts)}
                      </span>
                    </span>
                    {a.status === "active" && (
                      <button
                        onClick={() => onRevoke(a.id)}
                        disabled={pending}
                        className="text-osrs-red hover:bg-osrs-red/10 rounded px-2 py-1 text-xs disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-osrs-parchment-dark/60 text-sm">No badges yet.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
