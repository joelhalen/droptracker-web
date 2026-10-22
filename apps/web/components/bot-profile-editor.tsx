"use client";

/**
 * Bot appearance editor (web139a): the bot's nickname, bio, avatar and banner
 * in the group's Discord server.
 *
 * Images are cropped and resized in the browser to the exact size the bot
 * uses before upload, which keeps uploads well under the Server Action body
 * limit. The Web API validates and re-encodes them again regardless.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import type { BotProfile, BotProfileImageKind } from "@droptracker/api-types";
import { Alert, Button, Card, Field, FileInput, Input, Textarea } from "@/components/ui";
import {
  getBotProfileAction,
  removeBotImageAction,
  resetBotProfileAction,
  saveBotProfileAction,
  uploadBotImageAction,
  type BotProfileActionResult,
} from "@/app/(site)/(admin)/groups/[id]/bot/actions";

const DEFAULT_NAME = "DropTracker";
const DEFAULT_AVATAR = "/images/logo.png";

function hasCustomLook(p: Pick<BotProfile, "nick" | "bio" | "avatar_url" | "banner_url">): boolean {
  return Boolean(p.nick || p.bio || p.avatar_url || p.banner_url);
}

/** Center-crop and resize an image file to width x height, as a PNG blob. */
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
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the image."))), "image/png"),
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
    return <Alert variant="info">Applying in your Discord server. This usually takes a few seconds.</Alert>;
  }
  if (profile.status === "applied") {
    return <Alert variant="success">Live in your Discord server.</Alert>;
  }
  return <Alert variant="info">The bot is using its normal look.</Alert>;
}

function Preview({ nick, bio, avatar, banner }: { nick: string; bio: string; avatar: string; banner: string | null }) {
  const name = nick.trim() || DEFAULT_NAME;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 rounded-lg bg-[#313338] p-4 font-sans">
        <p className="mb-3 text-xs tracking-wide text-[#949ba4] uppercase">In a channel</p>
        <div className="flex items-start gap-3">
          <img src={avatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
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
          className="h-20 bg-[#5865f2] bg-cover bg-center"
          style={banner ? { backgroundImage: `url(${banner})` } : undefined}
        />
        <div className="px-4 pb-4">
          <img
            src={avatar}
            alt=""
            className="-mt-8 h-16 w-16 rounded-full border-[5px] border-[#232428] object-cover"
          />
          <p className="mt-1 truncate text-lg font-semibold text-white">{name}</p>
          {bio.trim() && <p className="mt-2 text-sm whitespace-pre-line text-[#dbdee1]">{bio.trim()}</p>}
        </div>
      </div>
    </div>
  );
}

export function BotProfileEditor({ groupId, initial }: { groupId: number; initial: BotProfile }) {
  const [profile, setProfile] = useState(initial);
  const [nick, setNick] = useState(initial.nick ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const dirty = (nick.trim() || null) !== (profile.nick ?? null) || (bio.trim() || null) !== (profile.bio ?? null);

  // While Discord is catching up, check back a few times so the status line
  // turns into "Live" or the reason it couldn't apply.
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

  function apply(result: BotProfileActionResult, message: string) {
    if (result.ok) {
      setProfile(result.data);
      setNick(result.data.nick ?? "");
      setBio(result.data.bio ?? "");
      setError(null);
      setNotice(message);
    } else {
      setError(result.error);
      setNotice(null);
    }
  }

  function saveText() {
    startTransition(async () => {
      apply(await saveBotProfileAction(groupId, { nick: nick.trim() || null, bio: bio.trim() || null }), "Saved.");
    });
  }

  function upload(kind: BotProfileImageKind, file: File | undefined) {
    if (!file) return;
    const [w, h] = kind === "avatar" ? profile.limits.avatar_size : profile.limits.banner_size;
    startTransition(async () => {
      try {
        const blob = await cropToSize(file, w, h);
        const form = new FormData();
        form.append("file", blob, `${kind}.png`);
        apply(await uploadBotImageAction(groupId, kind, form), kind === "avatar" ? "Avatar saved." : "Banner saved.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read that image.");
      }
      if (kind === "avatar" && avatarInput.current) avatarInput.current.value = "";
      if (kind === "banner" && bannerInput.current) bannerInput.current.value = "";
    });
  }

  function removeImage(kind: BotProfileImageKind) {
    startTransition(async () => {
      apply(await removeBotImageAction(groupId, kind), kind === "avatar" ? "Avatar removed." : "Banner removed.");
    });
  }

  function reset() {
    if (!window.confirm("Put the bot back to its normal name, picture and profile in your server?")) return;
    startTransition(async () => {
      apply(await resetBotProfileAction(groupId), "The bot is going back to its normal look.");
    });
  }

  const cooldownMinutes = Math.round(profile.limits.image_cooldown_seconds / 60);

  return (
    <div className="space-y-4">
      <StatusLine profile={profile} />
      {error && <Alert variant="error">{error}</Alert>}
      {notice && !error && <Alert variant="success">{notice}</Alert>}

      <Card padding="p-5" className="space-y-4">
        <Field
          label="Nickname"
          hint={`Up to ${profile.limits.nick_max} characters. Leave empty to keep the name DropTracker. If someone renames the bot in Discord, it changes back to this within a few minutes.`}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              className="w-full max-w-sm"
              value={nick}
              maxLength={profile.limits.nick_max}
              placeholder={DEFAULT_NAME}
              onChange={(e) => setNick(e.target.value)}
              disabled={pending}
            />
          )}
        </Field>
        <Field
          label="Bio"
          hint={`Shown when someone opens the bot's profile in your server. Up to ${profile.limits.bio_max} characters.`}
        >
          {(fieldProps) => (
            <Textarea
              {...fieldProps}
              className="w-full max-w-xl"
              value={bio}
              rows={3}
              maxLength={profile.limits.bio_max}
              onChange={(e) => setBio(e.target.value)}
              disabled={pending}
            />
          )}
        </Field>
        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={saveText} disabled={pending || !dirty}>
            {pending ? "Saving..." : "Save name and bio"}
          </Button>
        </div>
      </Card>

      <Card padding="p-5" className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-osrs-parchment text-sm font-medium">Avatar</p>
          <p className="text-osrs-parchment-dark/70 text-xs">
            PNG, JPEG or WebP. Cropped to a square.
          </p>
          <FileInput
            ref={avatarInput}
            accept="image/png,image/jpeg,image/webp"
            disabled={pending}
            onChange={(e) => upload("avatar", e.target.files?.[0])}
          />
          {profile.avatar_url && (
            <Button variant="ghost" size="xs" onClick={() => removeImage("avatar")} disabled={pending}>
              Remove avatar
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-osrs-parchment text-sm font-medium">Banner</p>
          <p className="text-osrs-parchment-dark/70 text-xs">
            PNG, JPEG or WebP. Cropped to a wide 5:2 strip.
          </p>
          <FileInput
            ref={bannerInput}
            accept="image/png,image/jpeg,image/webp"
            disabled={pending}
            onChange={(e) => upload("banner", e.target.files?.[0])}
          />
          {profile.banner_url && (
            <Button variant="ghost" size="xs" onClick={() => removeImage("banner")} disabled={pending}>
              Remove banner
            </Button>
          )}
        </div>
        <p className="text-osrs-parchment-dark/60 text-xs md:col-span-2">
          Discord limits how often a bot&apos;s pictures can change, so each image can be changed
          once every {cooldownMinutes} minutes.
        </p>
      </Card>

      <div>
        <p className="text-osrs-parchment mb-2 text-sm font-medium">Preview</p>
        <Preview
          nick={nick}
          bio={bio}
          avatar={profile.avatar_url ?? DEFAULT_AVATAR}
          banner={profile.banner_url}
        />
      </div>

      {hasCustomLook(profile) && (
        <div className="flex justify-end">
          <Button variant="danger" size="sm" onClick={reset} disabled={pending}>
            Reset to the normal look
          </Button>
        </div>
      )}
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
        The bot is back to its normal look because this group&apos;s subscription no longer includes
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
