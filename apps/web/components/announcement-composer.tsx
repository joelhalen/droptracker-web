"use client";

import { useEffect, useState, useTransition } from "react";
import type { AnnouncementInput, DiscordRole } from "@droptracker/api-types";
import {
  fetchDiscordRoles,
  publishAnnouncement,
} from "@/app/(admin)/groups/[id]/announcements/actions";
import { publishGlobalAnnouncement } from "@/app/(admin)/admin/announcements/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";

/**
 * Announcement composer for both group (pass `groupId`) and global (omit it,
 * superadmin) scopes.
 */
export function AnnouncementComposer({ groupId }: { groupId?: number }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [form, setForm] = useState<AnnouncementInput>({
    scope_type: groupId ? "group" : "global",
    group_id: groupId ?? null,
    title: "",
    body_md: "",
    pinned: false,
    post_to_discord: true,
    ping_role_ids: [],
    ping_user_ids: [],
    ping_everyone: false,
  });

  // Guild roles for the ping picker (group scope only). The bot warms a cold
  // cache within ~15s, so retry once while `stale`.
  const [roles, setRoles] = useState<DiscordRole[] | null>(null);
  useEffect(() => {
    if (!groupId) return;
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
    setForm((f) => ({
      ...f,
      ping_role_ids: f.ping_role_ids.includes(id)
        ? f.ping_role_ids.filter((r) => r !== id)
        : [...f.ping_role_ids, id],
    }));

  const set = <K extends keyof AnnouncementInput>(k: K, v: AnnouncementInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const valid = form.title.trim().length > 0 && form.body_md.trim().length > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setError(null);
    startTransition(async () => {
      try {
        if (groupId) await publishAnnouncement(groupId, form);
        else await publishGlobalAnnouncement(form);
        // Clear pings too — a follow-up post must not silently re-ping.
        setForm((f) => ({
          ...f,
          title: "",
          body_md: "",
          pinned: false,
          ping_role_ids: [],
          ping_user_ids: [],
          ping_everyone: false,
        }));
        setDone(true);
        setTimeout(() => setDone(false), 2500);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't publish the announcement. Please try again."));
      }
    });
  };

  const field = "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input
        value={form.title}
        onChange={(e) => set("title", e.target.value)}
        placeholder="Title"
        maxLength={200}
        className={field}
      />

      <div>
        <div className="mb-1 flex justify-end">
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            className="text-osrs-parchment-dark/70 text-xs hover:text-osrs-gold-bright"
          >
            {preview ? "Edit" : "Preview"}
          </button>
        </div>
        {preview ? (
          <div className="border-osrs-bronze/30 min-h-[8rem] whitespace-pre-wrap rounded border p-3 text-sm leading-relaxed">
            {form.body_md || <span className="text-osrs-parchment-dark/40">Nothing to preview.</span>}
          </div>
        ) : (
          <textarea
            value={form.body_md}
            onChange={(e) => set("body_md", e.target.value)}
            placeholder="Write your announcement in Markdown…"
            rows={6}
            className={field}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.pinned}
            onChange={(e) => set("pinned", e.target.checked)}
            className="size-4"
          />
          Pin to top
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.post_to_discord}
            onChange={(e) => set("post_to_discord", e.target.checked)}
            className="size-4"
          />
          Also post to Discord
        </label>
      </div>

      {groupId != null && form.post_to_discord && (
        <fieldset className="border-osrs-bronze/20 space-y-2 rounded border p-3">
          <legend className="text-osrs-gold px-1 text-sm font-semibold">Ping on Discord</legend>
          <p className="text-osrs-parchment-dark/60 text-xs">
            Selected pings are sent as real mentions above the announcement embed (mentions typed
            inside the announcement text can&apos;t ping — Discord ignores them in embeds).
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => set("ping_everyone", !form.ping_everyone)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                form.ping_everyone
                  ? "border-osrs-gold bg-osrs-gold/15 text-osrs-gold-bright"
                  : "border-osrs-bronze/40 hover:border-osrs-gold"
              }`}
              aria-pressed={form.ping_everyone}
            >
              @everyone
            </button>
            {(roles ?? []).map((r) => {
              const on = form.ping_role_ids.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleRole(r.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    on
                      ? "border-osrs-gold bg-osrs-gold/15 text-osrs-gold-bright"
                      : "border-osrs-bronze/40 hover:border-osrs-gold"
                  }`}
                  aria-pressed={on}
                >
                  @{r.name}
                </button>
              );
            })}
            {roles === null && (
              <span className="text-osrs-parchment-dark/50 text-xs">Loading roles…</span>
            )}
            {roles !== null && roles.length === 0 && (
              <span className="text-osrs-parchment-dark/50 text-xs">
                No roles found — the bot may still be syncing this server (retries shortly).
              </span>
            )}
          </div>
        </fieldset>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!valid || pending}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Publishing…" : "Publish"}
        </button>
        {done && <span className="text-osrs-green text-sm">Published.</span>}
      </div>
      {error && <Alert variant="error">{error}</Alert>}
    </form>
  );
}
