"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ANNOUNCEMENT_IN_GAME_DAILY_LIMIT,
  ANNOUNCEMENT_IN_GAME_MAX_CHARS,
  type AnnouncementInput,
  type DiscordRole,
} from "@droptracker/api-types";
import {
  fetchDiscordRoles,
  publishAnnouncement,
} from "@/app/(site)/(admin)/groups/[id]/announcements/actions";
import { publishGlobalAnnouncement } from "@/app/(site)/(admin)/admin/announcements/actions";
import { getErrorMessage, unwrapActionResult } from "@/lib/errors";
import { Alert, Button } from "@/components/ui";
import Link from "next/link";
import { Markdown } from "@/components/markdown";
import { sectionAnchor } from "@/lib/group-settings-sections";
import {
  AnnouncementDiscordPreview,
  AnnouncementInGamePreview,
} from "@/components/announcement-preview";

/** Embed-builder options, kept as plain strings while editing. */
type EmbedStyle = {
  color: string;
  url: string;
  thumbnail: string;
  image: string;
  footer: string;
  timestamp: boolean;
};

const DEFAULT_STYLE: EmbedStyle = {
  color: "#c8aa6e",
  url: "",
  thumbnail: "",
  image: "",
  footer: "",
  timestamp: false,
};

const isHttpUrl = (v: string) => /^https?:\/\/\S+$/i.test(v.trim());

/**
 * Announcement composer for both group (pass `groupId`) and global (omit it,
 * superadmin) scopes. Group posts can also go to members in game, and their
 * Discord embed takes the embed builder's options, with live previews of both.
 */
export function AnnouncementComposer({
  groupId,
  groupName = null,
  discordChannelSet = null,
}: {
  groupId?: number;
  groupName?: string | null;
  /** Group scope: whether an announcements channel is set. false locks the
   * Discord option off (the backend refuses it too); null = unknown. */
  discordChannelSet?: boolean | null;
}) {
  const noChannel = groupId != null && discordChannelSet === false;
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [form, setForm] = useState<AnnouncementInput>({
    scope_type: groupId ? "group" : "global",
    group_id: groupId ?? null,
    title: "",
    body_md: "",
    pinned: false,
    post_to_discord: !(groupId != null && discordChannelSet === false),
    ping_role_ids: [],
    ping_user_ids: [],
    ping_everyone: false,
    send_in_game: false,
    in_game_message: "",
    in_game_until: null,
    embed_timestamp: false,
  });
  // The "stop showing after" picker's local value (datetime-local has no zone).
  const [untilLocal, setUntilLocal] = useState("");
  const untilDate = untilLocal ? new Date(untilLocal) : null;
  const untilInvalid = untilDate != null && (Number.isNaN(untilDate.getTime()) || untilDate.getTime() <= Date.now());
  const [style, setStyle] = useState<EmbedStyle>(DEFAULT_STYLE);
  const [showStyle, setShowStyle] = useState(false);
  const setStyleKey = <K extends keyof EmbedStyle>(k: K, v: EmbedStyle[K]) =>
    setStyle((st) => ({ ...st, [k]: v }));

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

  const badLinks = (["url", "thumbnail", "image"] as const).filter(
    (k) => style[k].trim() && !isHttpUrl(style[k]),
  );
  const inGameText = (form.in_game_message ?? "").replace(/\s+/g, " ").trim();
  const inGameTooLong = inGameText.length > ANNOUNCEMENT_IN_GAME_MAX_CHARS;
  // A post that only goes in game needs no write-up: the backend uses the
  // in-game line (or the title) as the body (suggestion #247).
  const bodyOk = form.body_md.trim().length > 0 || (groupId != null && form.send_in_game);
  const valid =
    form.title.trim().length > 0 &&
    bodyOk &&
    badLinks.length === 0 &&
    !inGameTooLong &&
    !(form.send_in_game && untilInvalid);

  const pingNames = useMemo(() => {
    const names: string[] = [];
    if (form.ping_everyone) names.push("@everyone");
    for (const id of form.ping_role_ids) {
      const role = roles?.find((r) => r.id === id);
      names.push(`@${role?.name ?? "role"}`);
    }
    return names;
  }, [form.ping_everyone, form.ping_role_ids, roles]);

  /** The request body: the form plus the embed options, empty ones left out. */
  const payload = (): AnnouncementInput => ({
    ...form,
    in_game_message: form.send_in_game ? inGameText : undefined,
    in_game_until:
      form.send_in_game && untilDate && !untilInvalid ? untilDate.toISOString() : null,
    cover_image_url: style.image.trim() || null,
    embed_color: style.color !== DEFAULT_STYLE.color ? style.color : null,
    embed_url: style.url.trim() || null,
    embed_thumbnail_url: style.thumbnail.trim() || null,
    embed_footer: style.footer.trim() || null,
    embed_timestamp: style.timestamp,
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setError(null);
    startTransition(async () => {
      try {
        let message = "Published.";
        if (groupId) {
          const result = unwrapActionResult(await publishAnnouncement(groupId, payload()));
          if (form.send_in_game) {
            const n = result.in_game_recipients ?? 0;
            message =
              n > 0
                ? `Published, and sent in game to ${n.toLocaleString()} member${n === 1 ? "" : "s"}.`
                : "Published. The in-game message reached no one — no members, or all of them turned clan announcements off.";
          }
        } else {
          const result = await publishGlobalAnnouncement(payload());
          // Not written by the owner: it waits in the review queue instead.
          if (result.status === "draft") message = "Sent to the owner for review.";
        }
        // Clear pings too — a follow-up post must not silently re-ping.
        setForm((f) => ({
          ...f,
          title: "",
          body_md: "",
          pinned: false,
          ping_role_ids: [],
          ping_user_ids: [],
          ping_everyone: false,
          // A follow-up post must not silently go in game again either.
          send_in_game: false,
          in_game_message: "",
          in_game_until: null,
        }));
        setUntilLocal("");
        setDone(message);
        setTimeout(() => setDone(null), 8000);
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
          <div className="border-osrs-bronze/30 min-h-[8rem] rounded border p-3 text-sm leading-relaxed">
            {form.body_md.trim() ? (
              <Markdown>{form.body_md}</Markdown>
            ) : (
              <span className="text-osrs-parchment-dark/40">Nothing to preview.</span>
            )}
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
        <label
          className={`flex items-center gap-2 text-sm ${noChannel ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          title={noChannel ? "Set an announcements channel first" : undefined}
        >
          <input
            type="checkbox"
            checked={form.post_to_discord && !noChannel}
            disabled={noChannel}
            onChange={(e) => set("post_to_discord", e.target.checked)}
            className="size-4"
          />
          Also post to Discord
        </label>
        {groupId != null && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.send_in_game}
              onChange={(e) => set("send_in_game", e.target.checked)}
              className="size-4"
            />
            Send in-game message to members
          </label>
        )}
      </div>

      {noChannel && (
        <Alert variant="info">
          Your clan has no announcements channel, so this can&apos;t go to Discord yet.{" "}
          <Link
            href={`/groups/${groupId}/settings#${sectionAnchor("channels")}`}
            className="text-osrs-gold-bright underline"
          >
            Choose one in Settings → Channels
          </Link>
          , then come back to post here and on Discord.
        </Alert>
      )}

      {groupId != null && form.send_in_game && (
        <fieldset className="border-osrs-bronze/20 space-y-3 rounded border p-3">
          <legend className="text-osrs-gold px-1 text-sm font-semibold">In-game message</legend>
          <div>
            <input
              value={form.in_game_message ?? ""}
              onChange={(e) => set("in_game_message", e.target.value)}
              placeholder={form.title.trim() || "One line for the chatbox (defaults to the title)"}
              maxLength={ANNOUNCEMENT_IN_GAME_MAX_CHARS + 50}
              className={field}
            />
            <div
              className={`mt-1 text-right text-xs ${
                inGameTooLong ? "text-red-400" : "text-osrs-parchment-dark/50"
              }`}
            >
              {inGameText.length}/{ANNOUNCEMENT_IN_GAME_MAX_CHARS}
            </div>
          </div>
          <AnnouncementInGamePreview
            groupName={groupName ?? "Your clan"}
            title={form.title.trim()}
            message={inGameText}
          />
          <label className="grid gap-1 text-xs sm:max-w-xs">
            <span className="text-osrs-parchment-dark/70">Stop showing after (optional)</span>
            <input
              type="datetime-local"
              value={untilLocal}
              onChange={(e) => setUntilLocal(e.target.value)}
              className={field}
            />
            <span className={untilInvalid ? "text-red-400" : "text-osrs-parchment-dark/50"}>
              {untilInvalid
                ? "Pick a time in the future."
                : "For a reminder about something at a set time: members who log in after this won't see it. Empty = up to 24 hours."}
            </span>
          </label>
          <p className="text-osrs-parchment-dark/60 text-xs leading-relaxed">
            The pop-up shows your clan name and the title; the full message goes in the chatbox.
            Shown to every clan member running the DropTracker plugin
            (6.1.12 or newer, with API connections and event notifications on). Members who are
            offline get it when they next log in, within 24 hours (or until the time above).
            Plain text only, and it can&apos;t be recalled once sent. Members can turn clan
            announcements off in their notification settings. Up to{" "}
            {ANNOUNCEMENT_IN_GAME_DAILY_LIMIT} a day per clan. The write-up above is optional
            when a post goes in game: the in-game line stands in for it.
          </p>
        </fieldset>
      )}

      {/* Group posts only: the site-wide post goes out through HQ's #news
          layout (services/leader_updates.py), which these options don't touch. */}
      {groupId != null && form.post_to_discord && (
        <fieldset className="border-osrs-bronze/20 space-y-3 rounded border p-3">
          <legend className="text-osrs-gold px-1 text-sm font-semibold">Discord post</legend>
          <AnnouncementDiscordPreview
            draft={{
              title: form.title,
              body: form.body_md,
              color: style.color,
              url: style.url,
              thumbnail: style.thumbnail,
              image: style.image,
              footer: style.footer,
              timestamp: style.timestamp,
              pings: pingNames,
            }}
          />
          <button
            type="button"
            onClick={() => setShowStyle((v) => !v)}
            className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-xs"
            aria-expanded={showStyle}
          >
            {showStyle ? "Hide embed options" : "Customize embed…"}
          </button>
          {showStyle && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs">
                <span className="text-osrs-parchment-dark/70">Colour</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={style.color}
                    onChange={(e) => setStyleKey("color", e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-osrs-bronze/40 bg-transparent"
                  />
                  <input
                    value={style.color}
                    onChange={(e) => setStyleKey("color", e.target.value)}
                    maxLength={7}
                    className={field}
                  />
                </div>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-osrs-parchment-dark/70">Title link</span>
                <input
                  value={style.url}
                  onChange={(e) => setStyleKey("url", e.target.value)}
                  placeholder="https://…"
                  className={field}
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-osrs-parchment-dark/70">Thumbnail image URL</span>
                <input
                  value={style.thumbnail}
                  onChange={(e) => setStyleKey("thumbnail", e.target.value)}
                  placeholder="https://…/icon.png"
                  className={field}
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-osrs-parchment-dark/70">Large image URL</span>
                <input
                  value={style.image}
                  onChange={(e) => setStyleKey("image", e.target.value)}
                  placeholder="https://…/banner.png"
                  className={field}
                />
              </label>
              <label className="space-y-1 text-xs sm:col-span-2">
                <span className="text-osrs-parchment-dark/70">Footer</span>
                <input
                  value={style.footer}
                  onChange={(e) => setStyleKey("footer", e.target.value)}
                  maxLength={2048}
                  placeholder="e.g. AstralStar staff"
                  className={field}
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={style.timestamp}
                  onChange={(e) => setStyleKey("timestamp", e.target.checked)}
                  className="size-4"
                />
                Show timestamp
              </label>
              {badLinks.length > 0 && (
                <p className="text-xs text-red-400 sm:col-span-2">
                  Links and images must start with http:// or https://.
                </p>
              )}
            </div>
          )}
        </fieldset>
      )}

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
        <Button type="submit" variant="secondary" disabled={!valid || pending}>
          {pending ? "Publishing…" : "Publish"}
        </Button>
        {done && <span className="text-osrs-green text-sm">{done}</span>}
      </div>
      {error && <Alert variant="error">{error}</Alert>}
    </form>
  );
}
