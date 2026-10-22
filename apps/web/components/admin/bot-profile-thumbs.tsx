/**
 * Thumbnails for the avatar/banner URLs inside a bot_profile.* audit payload
 * (web139a), so staff can see what a group's bot was changed to without
 * opening each link.
 */
import { botProfileImages } from "@/lib/bot-profile";

export function BotProfileThumbs({ raw }: { raw: string | null }) {
  const images = botProfileImages(raw);
  if (images.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      {images.map(({ key, url }) => (
        <a key={key} href={url} target="_blank" rel="noreferrer" title={key.replace("_url", "")}>
          <img
            src={url}
            alt={key.replace("_url", "")}
            className={
              key === "avatar_url"
                ? "border-osrs-bronze/40 h-12 w-12 rounded-full border object-cover"
                : "border-osrs-bronze/40 h-12 w-[120px] rounded border object-cover"
            }
          />
        </a>
      ))}
    </div>
  );
}
