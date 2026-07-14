"use client";

import { useRef, useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { getErrorMessage } from "@/lib/errors";
import { removeGroupIcon, uploadGroupIcon } from "@/app/(site)/(admin)/groups/[id]/settings/actions";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/gif,image/webp";

/**
 * Group icon uploader for the group settings page. The icon shows on the
 * public group profile, in Discord notification embeds, and as the social
 * preview image when the group's pages are shared.
 */
export function GroupIconCard({
  groupId,
  initialIconUrl,
}: {
  groupId: number;
  initialIconUrl?: string;
}) {
  const [iconUrl, setIconUrl] = useState(initialIconUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("Icons are capped at 2 MB — try a smaller image.");
      return;
    }
    const form = new FormData();
    form.set("file", file);
    startTransition(async () => {
      try {
        const res = await uploadGroupIcon(groupId, form);
        setIconUrl(res.icon_url);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't upload the icon. Please try again."));
      }
    });
  }

  function onRemove() {
    setError(null);
    startTransition(async () => {
      try {
        await removeGroupIcon(groupId);
        setIconUrl(undefined);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't remove the icon. Please try again."));
      }
    });
  }

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center gap-4">
        {/* Plain <img>: uploaded GIFs stay animated (next/image would re-encode). */}
        {iconUrl ? (
          <img
            src={iconUrl}
            alt="Group icon"
            width={64}
            height={64}
            className="border-osrs-bronze/40 size-16 rounded-lg border object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="border-osrs-bronze/40 text-osrs-parchment-dark/50 flex size-16 items-center justify-center rounded-lg border border-dashed text-2xl"
          >
            ◇
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-osrs-gold font-semibold">Group icon</h2>
          <p className="text-osrs-parchment-dark/70 text-sm">
            Shown on your group page, Discord notifications, and link previews. PNG, JPEG, GIF, or
            WEBP up to 2 MB.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              onPick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => fileInput.current?.click()}
            className="bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Working…" : iconUrl ? "Replace icon" : "Upload icon"}
          </button>
          {iconUrl && (
            <button
              type="button"
              disabled={pending}
              onClick={onRemove}
              className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-osrs-red mt-3 text-sm">{error}</p>}
    </Card>
  );
}
