"use client";

/**
 * Bot appearance editor (web139a): the bot's nickname, bio, avatar and banner
 * in the group's Discord server.
 *
 * Everything is a draft until Save. Picking an image only shows it in the
 * preview (it stays in the browser); Save uploads any new image and sends the
 * whole look in one request, which is the only thing that changes the bot in
 * Discord. Empty fields mean "use the bot's own", and the page shows the core
 * bot's real name, picture, banner and bio wherever a field is unset.
 *
 * Images are cropped and resized in the browser to the exact size the bot
 * uses, which keeps the save well under the Server Action body limit. The Web
 * API validates and re-encodes them again regardless.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { BotProfile, BotProfileImageKind } from "@droptracker/api-types";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import {
  getBotProfileAction,
  resetBotProfileAction,
  saveBotProfileAction,
  type BotProfileActionResult,
} from "@/app/(site)/(admin)/groups/[id]/bot/actions";

const KINDS: BotProfileImageKind[] = ["avatar", "banner"];

type ImageDraft = { mode: "keep" } | { mode: "default" } | { mode: "new"; blob: Blob; preview: string };

function hasCustomLook(p: Pick<BotProfile, "nick" | "bio" | "avatar_url" | "banner_url">): boolean {
  return Boolean(p.nick || p.bio || p.avatar_url || p.banner_url);
}

function truncate(text: string | null, max: number): string {
  if (!text) return "";
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 3)}...` : flat;
}

/** Center-crop and resize an image file to width x height (WebP, PNG where unsupported). */
async function cropToSize(file: File, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file is not an image this browser can read."));
      el.src = url;
    });
    const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser could not prepare the image.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the image."))), "image/webp", 0.92),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function StatusLine({ profile }: { profile: BotProfile }) {
  if (!profile.entitled) {
    return (
      <Alert variant="info">
        This group&apos;s subscription does not include a custom bot appearance, so the bot keeps
        its normal look until it does.
      </Alert>
    );
  }
  if (profile.status === "error" && profile.last_error) {
    return <Alert variant="error">Couldn&apos;t apply in Discord: {profile.last_error}</Alert>;
  }
  if (profile.status === "pending") {
    return <Alert variant="info">Applying your saved look in Discord. This usually takes a few seconds.</Alert>;
  }
  if (profile.status === "applied") {
    return <Alert variant="success">Your saved look is live in your Discord server.</Alert>;
  }
  return <Alert variant="info">The bot is using its default look.</Alert>;
}

function Preview({ name, bio, avatar, banner }: { name: string; bio: string | null; avatar: string | null; banner: string | null }) {
  const pic = avatar ?? "/images/logo.png";
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 rounded-lg bg-[#313338] p-4 font-sans">
        <p className="mb-3 text-xs tracking-wide text-[#949ba4] uppercase">In a channel</p>
        <div className="flex items-start gap-3">
          <img src={pic} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
          <div className="min-w-0 grow">
            <div className="flex items-baseline gap-2">
              <span className="truncate font-medium text-white">{name}</span>
              <span className="rounded bg-[#5865f2] px-1 text-[10px] font-semibold text-white">APP</span>
              <span className="text-xs text-[#949ba4]">Today at 12:00</span>
            </div>
            <div className="border-osrs-gold mt-1 max-w-[420px] rounded border-l-4 bg-[#2b2d31] py-3 pr-4 pl-3">
              <p className="text-sm font-semibold text-white">Zezima received a drop!</p>
              <p className="mt-1 text-sm text-[#dbdee1]">Twisted bow from Chambers of Xeric</p>
            </div>
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg bg-[#232428] font-sans">
        <div
          className="h-24 bg-[#5865f2] bg-cover bg-center"
          style={banner ? { backgroundImage: `url(${banner})` } : undefined}
        />
        <div className="px-4 pb-4">
          <img
            src={pic}
            alt=""
            className="-mt-8 h-16 w-16 rounded-full border-[5px] border-[#232428] object-cover"
          />
          <p className="mt-1 truncate text-lg font-semibold text-white">{name}</p>
          {bio && (
            <>
              <p className="mt-3 text-[11px] font-bold tracking-wide text-[#b5bac1] uppercase">About me</p>
              <p className="mt-1 text-sm whitespace-pre-line text-[#dbdee1]">{bio}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ImageSlot({
  kind,
  url,
  state,
  canUseDefault,
  disabled,
  onPick,
  onUseDefault,
}: {
  kind: BotProfileImageKind;
  url: string | null;
  state: "default" | "custom" | "new";
  canUseDefault: boolean;
  disabled: boolean;
  onPick: (file: File | undefined) => void;
  onUseDefault: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const label = kind === "avatar" ? "Avatar" : "Banner";
  const badge =
    state === "new" ? "New, not saved yet" : state === "custom" ? "Your image" : "Default";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-osrs-parchment text-sm font-medium">{label}</p>
        <span
          className={
            state === "new"
              ? "text-osrs-gold text-xs font-medium"
              : "text-osrs-parchment-dark/70 text-xs"
          }
        >
          {badge}
        </span>
      </div>
      <div
        className={
          kind === "avatar"
            ? "border-osrs-bronze/40 h-24 w-24 overflow-hidden rounded-full border bg-[#2b2d31]"
            : "border-osrs-bronze/40 h-24 w-full max-w-[300px] overflow-hidden rounded-lg border bg-[#5865f2]"
        }
      >
        {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      </div>
      <p className="text-osrs-parchment-dark/70 text-xs">
        PNG, JPEG or WebP. {kind === "avatar" ? "Cropped to a square." : "Cropped to a wide 5:2 strip."}
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            onPick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button variant="secondary" size="xs" disabled={disabled} onClick={() => input.current?.click()}>
          Choose image
        </Button>
        {canUseDefault && (
          <Button variant="ghost" size="xs" disabled={disabled} onClick={onUseDefault}>
            Use default
          </Button>
        )}
      </div>
    </div>
  );
}

export function BotProfileEditor({ groupId, initial }: { groupId: number; initial: BotProfile }) {
  const [profile, setProfile] = useState(initial);
  const [nick, setNick] = useState(initial.nick ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [images, setImages] = useState<Record<BotProfileImageKind, ImageDraft>>({
    avatar: { mode: "keep" },
    banner: { mode: "keep" },
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const defaults = profile.defaults;

  // In-browser previews are object URLs: free each one when it is replaced,
  // and whatever is left when the page closes.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const live = previews.current;
    return () => {
      for (const url of live) URL.revokeObjectURL(url);
      live.clear();
    };
  }, []);

  function setDrafts(update: (prev: Record<BotProfileImageKind, ImageDraft>) => Record<BotProfileImageKind, ImageDraft>) {
    setImages((prev) => {
      const next = update(prev);
      for (const kind of KINDS) {
        const old = prev[kind];
        if (old.mode === "new" && next[kind] !== old) {
          URL.revokeObjectURL(old.preview);
          previews.current.delete(old.preview);
        }
      }
      return next;
    });
  }

  // While Discord is catching up, check back a few times so the status line
  // turns into "live" or the reason it couldn't apply.
  useEffect(() => {
    if (profile.status !== "pending" || !profile.entitled) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const res = await getBotProfileAction(groupId);
      if (res.ok) setProfile(res.data);
      if (tries >= 12 || (res.ok && res.data.status !== "pending")) clearInterval(timer);
    }, 5000);
    return () => clearInterval(timer);
  }, [groupId, profile.status, profile.entitled]);

  function savedUrl(kind: BotProfileImageKind): string | null {
    return kind === "avatar" ? profile.avatar_url : profile.banner_url;
  }

  function effectiveUrl(kind: BotProfileImageKind): string | null {
    const d = images[kind];
    const fallback = kind === "avatar" ? defaults.avatar_url : defaults.banner_url;
    if (d.mode === "new") return d.preview;
    if (d.mode === "default") return fallback;
    return savedUrl(kind) ?? fallback;
  }

  function slotState(kind: BotProfileImageKind): "default" | "custom" | "new" {
    const d = images[kind];
    if (d.mode === "new") return "new";
    if (d.mode === "keep" && savedUrl(kind)) return "custom";
    return "default";
  }

  const imageDirty = (kind: BotProfileImageKind) => {
    const d = images[kind];
    return d.mode === "new" || (d.mode === "default" && Boolean(savedUrl(kind)));
  };
  const dirty =
    (nick.trim() || null) !== (profile.nick ?? null) ||
    (bio.trim() || null) !== (profile.bio ?? null) ||
    KINDS.some(imageDirty);
  const draftIsDefault = !nick.trim() && !bio.trim() && KINDS.every((k) => slotState(k) === "default");

  const bioPlaceholder = useMemo(() => truncate(defaults.bio, 120), [defaults.bio]);

  function loadSaved(next: BotProfile) {
    setProfile(next);
    setNick(next.nick ?? "");
    setBio(next.bio ?? "");
    setDrafts(() => ({ avatar: { mode: "keep" }, banner: { mode: "keep" } }));
  }

  function apply(result: BotProfileActionResult, message: string) {
    if (result.ok) {
      loadSaved(result.data);
      setError(null);
      setNotice(message);
    } else {
      setError(result.error);
      setNotice(null);
    }
  }

  function pick(kind: BotProfileImageKind, file: File | undefined) {
    if (!file) return;
    const [w, h] = kind === "avatar" ? profile.limits.avatar_size : profile.limits.banner_size;
    startTransition(async () => {
      try {
        const blob = await cropToSize(file, w, h);
        const preview = URL.createObjectURL(blob);
        previews.current.add(preview);
        setDrafts((prev) => ({ ...prev, [kind]: { mode: "new", blob, preview } }));
        setError(null);
        setNotice(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read that image.");
      }
    });
  }

  function save() {
    const form = new FormData();
    form.set("nick", nick.trim());
    form.set("bio", bio.trim());
    for (const kind of KINDS) {
      const d = images[kind];
      if (d.mode === "new") form.set(`${kind}_file`, d.blob, `${kind}.webp`);
      else form.set(`${kind}_mode`, d.mode);
    }
    startTransition(async () => {
      apply(await saveBotProfileAction(groupId, form), "Saved. The bot will update in your server in a few seconds.");
    });
  }

  function discard() {
    loadSaved(profile);
    setError(null);
    setNotice(null);
  }

  function resetToDefaults() {
    setNick("");
    setBio("");
    setDrafts(() => ({ avatar: { mode: "default" }, banner: { mode: "default" } }));
    setError(null);
    setNotice("Showing the bot's default look. Save changes to put it back in your server.");
  }

  const name = nick.trim() || defaults.name;
  // A custom bio always ends with the signature (the bot adds it on apply);
  // the bot's own default bio is shown as it is.
  const shownBio = bio.trim() ? `${bio.trim()}\n\n${profile.limits.bio_signature}` : defaults.bio;

  return (
    <div className="space-y-4">
      <StatusLine profile={profile} />

      <Card padding="p-4" className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-osrs-parchment-dark/80 text-sm">
          {dirty
            ? "You have unsaved changes. Nothing changes in Discord until you save."
            : hasCustomLook(profile)
              ? "Your server sees the look below. Empty fields use the bot's default."
              : `Your server sees the default ${defaults.name} bot. Change anything below, then save.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetToDefaults}
            disabled={pending || draftIsDefault}
            title="Fill the form with the bot's default name, bio and pictures"
          >
            Reset to defaults
          </Button>
          <Button variant="ghost" size="sm" onClick={discard} disabled={pending || !dirty}>
            Discard changes
          </Button>
          <Button variant="primary" size="sm" onClick={save} disabled={pending || !dirty}>
            {pending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}
      {notice && !error && <Alert variant="success">{notice}</Alert>}

      <Card padding="p-5" className="space-y-4">
        <Field
          label="Nickname"
          hint={`Up to ${profile.limits.nick_max} characters. Leave empty to use the bot's own name, ${defaults.name}. If someone renames the bot in Discord, it changes back to this within a few minutes.`}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              className="w-full max-w-sm"
              value={nick}
              maxLength={profile.limits.nick_max}
              placeholder={defaults.name}
              onChange={(e) => setNick(e.target.value)}
              disabled={pending}
            />
          )}
        </Field>
        <Field
          label="Bio"
          hint={`Shown when someone opens the bot's profile in your server. Up to ${profile.limits.bio_max} characters. Leave empty to use the bot's own bio.`}
        >
          {(fieldProps) => (
            <Textarea
              {...fieldProps}
              className="w-full max-w-xl"
              value={bio}
              rows={3}
              maxLength={profile.limits.bio_max}
              placeholder={bioPlaceholder}
              onChange={(e) => setBio(e.target.value)}
              disabled={pending}
            />
          )}
        </Field>
        <div className="border-osrs-bronze/30 bg-osrs-brown-dark/40 max-w-xl rounded-lg border border-dashed px-3 py-2">
          <p className="text-osrs-parchment-dark/60 text-[11px] font-semibold tracking-wide uppercase">
            Always added under a custom bio
          </p>
          <p className="text-osrs-parchment-dark/80 mt-1 text-sm whitespace-pre-line">
            {profile.limits.bio_signature}
          </p>
        </div>
      </Card>

      <Card padding="p-5" className="space-y-4">
        <div className="grid gap-6 md:grid-cols-2">
          {KINDS.map((kind) => (
            <ImageSlot
              key={kind}
              kind={kind}
              url={effectiveUrl(kind)}
              state={slotState(kind)}
              canUseDefault={slotState(kind) !== "default"}
              disabled={pending}
              onPick={(file) => pick(kind, file)}
              onUseDefault={() => setDrafts((prev) => ({ ...prev, [kind]: { mode: "default" } }))}
            />
          ))}
        </div>
        <p className="text-osrs-parchment-dark/60 text-xs">
          New images show in the preview straight away and only reach Discord when you save. Discord
          limits how often a bot&apos;s pictures can change, so each one can be saved once every{" "}
          {Math.round(profile.limits.image_cooldown_seconds / 60)} minutes.
        </p>
      </Card>

      <div>
        <p className="text-osrs-parchment mb-2 text-sm font-medium">
          Preview{dirty ? " (unsaved)" : ""}
        </p>
        <Preview name={name} bio={shownBio} avatar={effectiveUrl("avatar")} banner={effectiveUrl("banner")} />
      </div>
    </div>
  );
}

/** For a group whose subscription ended: its saved look is kept, not live. */
export function BotProfileLapsedNote({ groupId, profile }: { groupId: number; profile: BotProfile }) {
  const [cleared, setCleared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (cleared || profile.entitled || !hasCustomLook(profile)) return null;
  return (
    <Card padding="p-4" className="space-y-2">
      <p className="text-osrs-parchment-dark/80 text-sm">
        The bot is back to its default look because this group&apos;s subscription no longer includes
        a custom bot appearance. Your saved name and pictures come back if you upgrade again.
      </p>
      {error && <Alert variant="error">{error}</Alert>}
      <Button
        variant="ghost"
        size="xs"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await resetBotProfileAction(groupId);
            if (res.ok) setCleared(true);
            else setError(res.error);
          })
        }
      >
        Delete saved settings
      </Button>
    </Card>
  );
}
