"use client";

/**
 * /admin/bot-profiles (web139a): every group's custom bot look, newest change
 * first, with its recent history. Superadmins can put any group's bot back to
 * its default look.
 */
import { useState, useTransition } from "react";
import type { AdminBotProfile } from "@droptracker/api-types";
import { Badge, Button, Card } from "@/components/ui";
import { BotProfileThumbs } from "@/components/admin/bot-profile-thumbs";
import { formatRelativeTime } from "@/lib/format";
import { adminResetBotProfile } from "@/app/(site)/(admin)/admin/bot-profiles/actions";

const ACTION_LABELS: Record<string, string> = {
  "bot_profile.update": "Changed",
  "bot_profile.reset": "Reset by the group",
  "bot_profile.staff_reset": "Reset by staff",
  "bot_profile.lapse_revert": "Subscription ended",
};

function hasCustomLook(p: AdminBotProfile): boolean {
  return Boolean(p.nick || p.bio || p.avatar_url || p.banner_url);
}

function stateLabel(p: AdminBotProfile): { text: string; tone: string } {
  if (!hasCustomLook(p)) return { text: "Default", tone: "text-osrs-parchment-dark/70" };
  if (!p.entitled) return { text: "Lapsed (not live)", tone: "text-osrs-parchment-dark/70" };
  if (p.status === "error") return { text: "Error", tone: "text-osrs-red" };
  if (p.status === "pending") return { text: "Applying", tone: "text-osrs-gold" };
  return { text: "Live", tone: "text-osrs-green" };
}

function changedFields(raw: string | null): string {
  if (!raw) return "";
  try {
    return Object.keys(JSON.parse(raw) as object)
      .map((k) => k.replace("_url", ""))
      .join(", ");
  } catch {
    return "";
  }
}

function ProfileCard({ profile, canReset }: { profile: AdminBotProfile; canReset: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const state = stateLabel(profile);
  const avatar = profile.avatar_url ?? "/images/logo.png";

  function reset() {
    if (!window.confirm(`Reset ${profile.group_name ?? "this group"}'s bot to its default look?`)) return;
    startTransition(async () => {
      const res = await adminResetBotProfile(profile.group_id);
      if ("error" in res && res.error) setError(res.error);
    });
  }

  return (
    <Card padding="p-0" className="overflow-hidden" id={`g${profile.group_id}`}>
      <div
        className="h-16 bg-[#5865f2] bg-cover bg-center"
        style={profile.banner_url ? { backgroundImage: `url(${profile.banner_url})` } : undefined}
      />
      <div className="space-y-2 px-4 pb-4">
        <div className="flex items-end justify-between gap-2">
          <img
            src={avatar}
            alt=""
            className="border-osrs-surface-2 -mt-7 h-14 w-14 rounded-full border-4 object-cover"
          />
          <span className={`text-xs font-medium ${state.tone}`}>{state.text}</span>
        </div>
        <div>
          <p className="text-osrs-parchment truncate font-semibold">{profile.nick || "DropTracker"}</p>
          <p className="text-osrs-parchment-dark/70 truncate text-xs">
            <a href={`/groups/${profile.group_id}`} className="hover:underline">
              {profile.group_name ?? `Group ${profile.group_id}`}
            </a>{" "}
            · #{profile.group_id}
          </p>
        </div>
        {profile.bio && (
          <p className="text-osrs-parchment-dark/80 line-clamp-3 text-xs whitespace-pre-line">{profile.bio}</p>
        )}
        {profile.last_error && profile.status === "error" && (
          <p className="text-osrs-red text-xs">{profile.last_error}</p>
        )}
        <p className="text-osrs-parchment-dark/60 text-xs">
          {profile.updated_at ? `Changed ${formatRelativeTime(profile.updated_at)}` : "Never changed"}
          {profile.updated_by_name ? ` by ${profile.updated_by_name}` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {profile.history.length > 0 && (
            <Button variant="ghost" size="xs" onClick={() => setOpen((v) => !v)}>
              {open ? "Hide history" : `History (${profile.history.length})`}
            </Button>
          )}
          {canReset && hasCustomLook(profile) && (
            <Button variant="danger" size="xs" onClick={reset} disabled={pending}>
              {pending ? "Resetting..." : "Reset"}
            </Button>
          )}
        </div>
        {error && <p className="text-osrs-red text-xs">{error}</p>}
        {open && (
          <ul className="border-osrs-bronze/20 space-y-2 border-t pt-2">
            {profile.history.map((h, i) => (
              <li key={i} className="text-xs">
                <span className="text-osrs-parchment">{ACTION_LABELS[h.action] ?? h.action}</span>
                {changedFields(h.after) && (
                  <span className="text-osrs-parchment-dark/70">: {changedFields(h.after)}</span>
                )}
                {h.created_at && (
                  <span className="text-osrs-parchment-dark/50"> · {formatRelativeTime(h.created_at)}</span>
                )}
                <BotProfileThumbs raw={h.after} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export function BotProfilesGallery({ profiles, canReset }: { profiles: AdminBotProfile[]; canReset: boolean }) {
  const [filter, setFilter] = useState<"all" | "live" | "issues">("all");
  const shown = profiles.filter((p) => {
    if (filter === "live") return p.entitled && hasCustomLook(p) && p.status === "applied";
    if (filter === "issues") return p.status === "error" || (!p.entitled && hasCustomLook(p));
    return true;
  });
  const live = profiles.filter((p) => p.entitled && hasCustomLook(p) && p.status === "applied").length;

  if (profiles.length === 0) {
    return <p className="text-osrs-parchment-dark/70 text-sm">No group has customized the bot yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{live} live</Badge>
        {(["all", "live", "issues"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "secondary" : "ghost"} size="xs" onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "live" ? "Live" : "Errors and lapsed"}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((p) => (
          <ProfileCard key={p.group_id} profile={p} canReset={canReset} />
        ))}
      </div>
    </div>
  );
}
