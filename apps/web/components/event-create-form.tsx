"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { EVENT_MODES, type DiscordRole, type EventDiscordPolicy } from "@droptracker/api-types";
import { createGroupEvent } from "@/app/(site)/(admin)/groups/[id]/events/actions";
import { fetchDiscordRoles } from "@/app/(site)/(admin)/groups/[id]/announcements/actions";
import { getErrorMessage } from "@/lib/errors";
import { EVENT_MODE_LABELS } from "@/lib/events";
import { Alert } from "@/components/ui";
import { DiscordRolePicker } from "@/components/discord-role-picker";
import { EventTemplatePicker } from "@/components/event-template-picker";
import { TimezoneNote } from "@/components/local-time";

/** Convert a datetime-local value to unix seconds (or null). */
const toUnix = (v: string): number | null => (v ? Math.floor(new Date(v).getTime() / 1000) : null);

/** `groupId` is null when creating a global event from /admin/events
 * (superadmin-only). New events are drafts: configure them, then Activate. */
export function EventCreateForm({ groupId }: { groupId: number | null }) {
  const router = useRouter();
  // Brand-new event vs re-running a saved template ("Saving/Rerunning Events").
  const [source, setSource] = useState<"new" | "template">("new");
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [mode, setMode] = useState<(typeof EVENT_MODES)[number]>("standard");
  // When the Discord scheduled event is created: with the default the draft
  // stays invisible on Discord until it's activated.
  const [discordPolicy, setDiscordPolicy] = useState<EventDiscordPolicy>("on_activate");
  const [pingRoleIds, setPingRoleIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Roles of the group's linked guild for the ping picker (the new event's
  // default Discord server). The bot warms a cold cache within ~15s → retry
  // once while `stale`. Global events have no default guild — no picker.
  const [roles, setRoles] = useState<DiscordRole[] | null>(null);
  useEffect(() => {
    if (groupId == null) return;
    let cancelled = false;
    let retried = false;
    const load = () => {
      fetchDiscordRoles(groupId)
        .then((r) => {
          if (cancelled) return;
          setRoles(r.roles);
          if (r.stale && !retried) {
            retried = true;
            setTimeout(load, 16_000);
          }
        })
        .catch(() => !cancelled && setRoles([]));
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const toggleRole = (id: string) =>
    setPingRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  const field =
    "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await createGroupEvent(groupId, {
          name,
          description: description || undefined,
          starts_at: toUnix(startsAt),
          ends_at: toUnix(endsAt),
          ...(groupId != null ? { mode } : {}),
          discord_event_policy: discordPolicy,
          ...(pingRoleIds.length ? { pings: { event_created: pingRoleIds } } : {}),
        });
        router.push(
          (groupId == null
            ? `/admin/events/${res.id}`
            : `/groups/${groupId}/events/${res.id}`) as Route,
        );
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't create the event. Please try again."));
      }
    });
  };

  const sourceTab = (active: boolean) =>
    `rounded px-3 py-1.5 text-sm font-medium ${
      active
        ? "bg-osrs-bronze text-osrs-parchment"
        : "text-osrs-parchment-dark/70 hover:text-osrs-gold-bright"
    }`;

  return (
    <div className="space-y-3">
      <div className="border-osrs-bronze/25 inline-flex gap-1 rounded-lg border p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={source === "new"}
          onClick={() => setSource("new")}
          className={sourceTab(source === "new")}
        >
          Brand-new event
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={source === "template"}
          onClick={() => setSource("template")}
          className={sourceTab(source === "template")}
        >
          Start from a template
        </button>
      </div>

      {source === "template" ? (
        <EventTemplatePicker groupId={groupId} />
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          {error && <Alert variant="error">{error}</Alert>}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Event name"
            className={field}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className={field}
          />
          {groupId != null && (
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Event type</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as (typeof EVENT_MODES)[number])}
                className={field}
              >
                {EVENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {EVENT_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
              {mode === "clan_vs_clan" && (
                <p className="text-osrs-parchment-dark/50 mt-1 text-xs">
                  Your clan hosts the event. Invite an opponent from the event manager after
                  creating it.
                </p>
              )}
            </label>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Starts</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={field}
              />
            </label>
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Ends</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={field}
              />
            </label>
          </div>
          <TimezoneNote className="text-osrs-parchment-dark/60 block text-xs" />

          <fieldset className="border-osrs-bronze/20 space-y-2 rounded border p-3">
            <legend className="text-osrs-gold px-1 text-sm font-semibold">Discord event</legend>
            <p className="text-osrs-parchment-dark/60 text-xs">
              A matching Discord scheduled event is created on the event&apos;s Discord server
              {groupId != null ? " (your clan's linked server by default)" : ""}. When should it
              appear?
            </p>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="discord-event-policy"
                checked={discordPolicy === "on_activate"}
                onChange={() => setDiscordPolicy("on_activate")}
                className="mt-0.5"
              />
              <span>
                When the event goes live
                <span className="text-osrs-parchment-dark/50 block text-xs">
                  Nothing is posted to Discord while this is still a draft (recommended).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="discord-event-policy"
                checked={discordPolicy === "immediate"}
                onChange={() => setDiscordPolicy("immediate")}
                className="mt-0.5"
              />
              <span>
                Right away
                <span className="text-osrs-parchment-dark/50 block text-xs">
                  Creates the Discord event immediately, even while you&apos;re still drafting.
                </span>
              </span>
            </label>
            {groupId != null && (
              <div className="pt-1">
                <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                  Ping these roles when the Discord event is created
                </span>
                <DiscordRolePicker roles={roles} selected={pingRoleIds} onToggle={toggleRole} />
              </div>
            )}
          </fieldset>

          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create event"}
          </button>
        </form>
      )}
    </div>
  );
}
